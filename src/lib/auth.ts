import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { compare } from "bcryptjs";
import { db } from "./db";
import { assert } from "./rules";
import type { Role } from "@prisma/client";
const COOKIE = "folio_session";
export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: digest(token) },
    include: { user: { include: { student: true } } },
  });
  return session && session.expiresAt > new Date() && session.user.active
    ? session.user
    : null;
}
export async function requireUser(roles?: Role[]) {
  const user = await currentUser();
  assert(user, "Please sign in.", 401);
  assert(
    !roles || roles.includes(user.role),
    "You do not have permission for this action.",
    403,
  );
  return user;
}
export async function pageUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export async function authenticate(email: string, password: string) {
  const key = digest(email.toLowerCase());
  const attempt = await db.loginAttempt.upsert({
    where: { key },
    create: { key, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (Date.now() - attempt.windowStart.getTime() > 15 * 60_000)
    await db.loginAttempt.update({
      where: { key },
      data: { count: 1, windowStart: new Date() },
    });
  else
    assert(
      attempt.count <= 10,
      "Too many attempts. Please try again in 15 minutes.",
      429,
    );
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  // Constant-cost comparison also for nonexistent accounts.
  const valid = await compare(
    password,
    user?.passwordHash ??
      "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
  );
  assert(user?.active && valid, "Email or password is incorrect.", 401);
  await db.loginAttempt.deleteMany({ where: { key } });
  return user;
}
export async function signIn(email: string, password: string) {
  const user = await authenticate(email, password);
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 8 * 60 * 60_000);
  await db.session.create({
    data: { id: digest(token), userId: user.id, expiresAt },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
export async function signOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: digest(token) } });
  jar.delete(COOKIE);
}
