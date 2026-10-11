import { db } from "./db";
import { fineAmount, overdueDays } from "./rules";
import type { Actor } from "./services";
export const loanInclude = {
  copy: { include: { book: true } },
  student: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  issuedBy: { select: { name: true } },
  fine: {
    include: {
      settlements: { include: { recordedBy: { select: { name: true } } } },
    },
  },
} as const;
export function scoped(actor: Actor) {
  return actor.role === "STUDENT"
    ? { studentId: actor.student?.id ?? "__none__" }
    : {};
}
export async function getLoans(actor: Actor) {
  return db.loan.findMany({
    where: scoped(actor),
    include: loanInclude,
    orderBy: { issuedAt: "desc" },
  });
}
export type LoanRecord = Awaited<ReturnType<typeof getLoans>>[number];
export function loanMoney(loan: LoanRecord, now = new Date()) {
  const assessed =
    loan.fine?.assessed ??
    fineAmount(
      loan.dueAt,
      loan.returnedAt ?? now,
      loan.dailyFine,
      loan.graceDays,
    );
  const settled = loan.fine?.settlements.reduce((s, p) => s + p.amount, 0) ?? 0;
  return {
    assessed,
    settled,
    outstanding: assessed - settled,
    days: overdueDays(loan.dueAt, loan.returnedAt ?? now),
  };
}
export async function overview(actor: Actor) {
  const [loans, books, students, requests] = await Promise.all([
    getLoans(actor),
    db.book.findMany({
      where: { archived: false },
      include: { copies: true, category: true },
      orderBy: { title: "asc" },
    }),
    db.student.count({ where: { user: { active: true } } }),
    db.bookRequest.findMany({
      where: scoped(actor),
      include: {
        book: true,
        student: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const active = loans.filter((l) => !l.returnedAt),
    overdue = active.filter((l) => overdueDays(l.dueAt) > 0);
  const copies = books.flatMap((b) => b.copies);
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 6 + i);
    const key = d.toISOString().slice(0, 10);
    return {
      day: d.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" }),
      issues: loans.filter((l) => l.issuedAt.toISOString().startsWith(key))
        .length,
      returns: loans.filter((l) => l.returnedAt?.toISOString().startsWith(key))
        .length,
    };
  });
  return {
    loans,
    books,
    requests,
    active,
    overdue,
    trend,
    stats: {
      titles: books.length,
      copies: copies.length,
      available: copies.filter((c) => c.status === "AVAILABLE").length,
      issued: active.length,
      pending: requests.filter((r) => r.status === "PENDING").length,
      overdue: overdue.length,
      outstanding: loans.reduce((s, l) => s + loanMoney(l).outstanding, 0),
      students,
    },
  };
}
