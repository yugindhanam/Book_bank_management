import { db } from "./db";
import { getLoans, loanMoney } from "./queries";
import type { Actor } from "./services";
import { assert, canManage, overdueDays } from "./rules";
export async function report(actor: Actor, params: Record<string, string>) {
  assert(canManage(actor.role), "Staff access required.", 403);
  const start = params.start
    ? new Date(`${params.start}T00:00:00Z`)
    : new Date(0);
  const end = params.end ? new Date(`${params.end}T23:59:59.999Z`) : new Date();
  assert(
    Number.isFinite(start.getTime()) &&
      Number.isFinite(end.getTime()) &&
      start <= end,
    "Choose a valid date range.",
  );
  const all = await getLoans(actor);
  const search = (l: (typeof all)[number]) =>
    `${l.student.user.name} ${l.student.rollNumber} ${l.copy.book.title}`
      .toLowerCase()
      .includes((params.q || "").toLowerCase());
  const loans = all.filter(
    (l) => l.issuedAt >= start && l.issuedAt <= end && search(l),
  );
  const returns = all.filter(
    (l) =>
      l.returnedAt && l.returnedAt >= start && l.returnedAt <= end && search(l),
  );
  const current = all.filter(search);
  const settlements = current
    .flatMap((l) => l.fine?.settlements ?? [])
    .filter((s) => s.createdAt >= start && s.createdAt <= end);
  const categories = await db.category.findMany({
    include: {
      books: { where: { archived: false }, include: { copies: true } },
    },
    orderBy: { name: "asc" },
  });
  const books = categories.flatMap((c) => c.books);
  const copies = books.flatMap((b) => b.copies);
  const grouped = new Map<
    string,
    { day: string; issues: number; returns: number }
  >();
  for (const l of loans) {
    const key = l.issuedAt.toISOString().slice(0, 7);
    const entry = grouped.get(key) ?? { day: key, issues: 0, returns: 0 };
    entry.issues++;
    grouped.set(key, entry);
  }
  for (const l of returns) {
    const key = l.returnedAt!.toISOString().slice(0, 7);
    const entry = grouped.get(key) ?? { day: key, issues: 0, returns: 0 };
    entry.returns++;
    grouped.set(key, entry);
  }
  const popular: Record<string, number> = {},
    borrowers: Record<string, number> = {};
  for (const l of loans) {
    popular[l.copy.book.title] = (popular[l.copy.book.title] || 0) + 1;
    const borrower = `${l.student.user.name} (${l.student.rollNumber})`;
    borrowers[borrower] = (borrowers[borrower] || 0) + 1;
  }
  return {
    loans,
    returns,
    categories,
    trend: [...grouped.values()].sort((a, b) => a.day.localeCompare(b.day)),
    popular: Object.entries(popular).sort((a, b) => b[1] - a[1]),
    borrowers: Object.entries(borrowers).sort((a, b) => b[1] - a[1]),
    totals: {
      titles: books.length,
      copies: copies.length,
      available: copies.filter((c) => c.status === "AVAILABLE").length,
      issued: copies.filter((c) => c.status === "ISSUED").length,
      issues: loans.length,
      returns: returns.length,
      overdue: current.filter((l) => !l.returnedAt && overdueDays(l.dueAt) > 0)
        .length,
      outstanding: current.reduce((s, l) => s + loanMoney(l).outstanding, 0),
      settled: settlements
        .filter((s) => !s.waived)
        .reduce((s, p) => s + p.amount, 0),
      waived: settlements
        .filter((s) => s.waived)
        .reduce((s, p) => s + p.amount, 0),
    },
  };
}
