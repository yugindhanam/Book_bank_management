import "dotenv/config";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
const base = process.env.DATABASE_URL;
if (!base) throw new Error("DATABASE_URL is required");
const schema = `folio_e2e_${Date.now()}`;
const url = new URL(base);
url.searchParams.set("schema", schema);
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  DEMO_PASSWORD: "E2E-Only-Password-2026!",
  FOLIO_E2E: "true",
  APP_ORIGIN: "http://127.0.0.1:3100",
};
try {
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env, stdio: "pipe" },
  );
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"],
    { env, stdio: "inherit" },
  );
  execFileSync(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test"],
    { env, stdio: "inherit" },
  );
} catch {
  process.exitCode = 1;
} finally {
  const db = new PrismaClient({ datasourceUrl: base });
  await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await db.$disconnect();
}
