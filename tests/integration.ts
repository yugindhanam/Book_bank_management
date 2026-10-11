import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
// Every run uses its own PostgreSQL schema; application data is never modified.
const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) throw new Error("DATABASE_URL is required");
const schema = `folio_test_${Date.now()}`;
const url = new URL(baseUrl);
url.searchParams.set("schema", schema);
process.env.DATABASE_URL = url.toString();
execFileSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { stdio: "pipe", env: process.env },
);
const { db } = await import("../src/lib/db");
const {
  mutate,
  saveBook,
  saveStudent,
  issueBook,
  returnBook,
  settleFine,
  submitRequest,
  reviewRequest,
} = await import("../src/lib/services");
const { authenticate } = await import("../src/lib/auth");
const { report } = await import("../src/lib/reports");
const { getLoans, loanMoney } = await import("../src/lib/queries");
const { DAY } = await import("../src/lib/rules");
let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
try {
  const password = "Integration-Test-2026!";
  const passwordHash = await hash(password, 12);
  const admin = await db.user.create({
    data: {
      name: "Test Admin",
      email: "admin@test.local",
      passwordHash,
      role: "ADMIN",
    },
  });
  const librarian = await db.user.create({
    data: {
      name: "Test Librarian",
      email: "staff@test.local",
      passwordHash,
      role: "LIBRARIAN",
    },
  });
  await db.librarySettings.create({
    data: {
      id: "library",
      maxLoans: 2,
      loanDays: 14,
      dailyFine: 500,
      graceDays: 1,
    },
  });
  const category = await db.category.create({
    data: { name: "Test category" },
  });
  const student = await saveStudent(admin, {
    name: "Test Student",
    email: "student@test.local",
    rollNumber: "TEST-001",
    department: "CS",
    semester: 1,
    password,
  });
  const other = await saveStudent(admin, {
    name: "Other Student",
    email: "other@test.local",
    rollNumber: "TEST-002",
    department: "CS",
    semester: 2,
    password,
  });
  const actor = {
    id: student.userId,
    role: "STUDENT" as const,
    student: { id: student.id },
  };
  let book = await saveBook(admin, {
    title: "Original title",
    author: "Test Author",
    categoryId: category.id,
    shelf: "A1",
    copies: 4,
    isbn: "TEST-ISBN",
  });
  const copies = await db.bookCopy.findMany({
    where: { bookId: book.id },
    orderBy: { accession: "asc" },
  });
  await test("valid and invalid login", async () => {
    assert.equal(
      (await authenticate("admin@test.local", password)).id,
      admin.id,
    );
    await assert.rejects(
      () => authenticate("admin@test.local", "wrong"),
      /incorrect/,
    );
    await assert.rejects(
      () => authenticate("missing@test.local", "wrong"),
      /incorrect/,
    );
  });
  await test("login throttling", async () => {
    for (let i = 0; i < 9; i++)
      await assert.rejects(() => authenticate("throttle@test.local", "wrong"));
    await assert.rejects(() => authenticate("throttle@test.local", "wrong"));
    await assert.rejects(
      () => authenticate("throttle@test.local", "wrong"),
      /Too many attempts/,
    );
  });
  await test("server-side roles protect books, settings, and staff", async () => {
    await assert.rejects(
      () => saveBook(actor, { title: "Denied" }),
      /Staff access/,
    );
    await assert.rejects(
      () =>
        mutate(librarian, "settings", {
          name: "X",
          loanDays: 1,
          maxLoans: 1,
          dailyFine: 0,
          graceDays: 0,
        }),
      /Administrator/,
    );
    await assert.rejects(() => mutate(librarian, "staff", {}), /Administrator/);
  });
  await test("book creation and editing preserve copies", async () => {
    book = await saveBook(admin, {
      ...book,
      title: "Edited title",
      isbn: "TEST-ISBN",
    });
    assert.equal(book.title, "Edited title");
    assert.equal(await db.bookCopy.count({ where: { bookId: book.id } }), 4);
  });
  await test("student registration and duplicate prevention", async () => {
    assert.equal(
      (await db.student.findUniqueOrThrow({ where: { id: student.id } }))
        .rollNumber,
      "TEST-001",
    );
    await assert.rejects(() =>
      saveStudent(admin, {
        name: "Duplicate",
        email: "another@test.local",
        rollNumber: "TEST-001",
        department: "CS",
        semester: 1,
        password,
      }),
    );
  });
  await test("duplicate accession prevention", async () => {
    await assert.rejects(() =>
      mutate(admin, "copy", {
        bookId: book.id,
        accession: copies[0].accession,
        status: "AVAILABLE",
      }),
    );
  });
  await test("request lifecycle, duplicate prevention and private cancellation", async () => {
    const r = await submitRequest(actor, book.id);
    await assert.rejects(() => submitRequest(actor, book.id), /active request/);
    await assert.rejects(
      () =>
        reviewRequest(
          { id: other.userId, role: "STUDENT", student: { id: other.id } },
          { id: r.id, status: "CANCELLED" },
        ),
      /Access denied/,
    );
    await reviewRequest(librarian, { id: r.id, status: "APPROVED" });
    assert.equal(
      (await db.bookCopy.findUniqueOrThrow({ where: { id: copies[0].id } }))
        .status,
      "AVAILABLE",
    );
    await issueBook(librarian, {
      studentId: student.id,
      copyId: copies[0].id,
      requestId: r.id,
    });
    assert.equal(
      (await db.bookRequest.findUniqueOrThrow({ where: { id: r.id } })).status,
      "FULFILLED",
    );
  });
  await test("unavailable copy cannot be reissued", async () => {
    await assert.rejects(
      () => issueBook(librarian, { studentId: other.id, copyId: copies[0].id }),
      /not available/,
    );
  });
  await test("borrowing limits and due dates", async () => {
    const l = await issueBook(librarian, {
      studentId: student.id,
      copyId: copies[1].id,
    });
    assert.equal(l.dueAt.getTime() - l.issuedAt.getTime(), 14 * DAY);
    await assert.rejects(
      () =>
        issueBook(librarian, { studentId: student.id, copyId: copies[2].id }),
      /Borrowing limit/,
    );
  });
  await test("concurrent issuance produces exactly one loan", async () => {
    const results = await Promise.allSettled([
      issueBook(librarian, { studentId: other.id, copyId: copies[2].id }),
      issueBook(admin, { studentId: other.id, copyId: copies[2].id }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      await db.loan.count({
        where: { copyId: copies[2].id, returnedAt: null },
      }),
      1,
    );
  });
  await test("database partial index rejects direct duplicate active loans", async () => {
    await assert.rejects(() =>
      db.loan.create({
        data: {
          copyId: copies[2].id,
          studentId: student.id,
          issuedById: admin.id,
          dueAt: new Date(Date.now() + DAY),
          dailyFine: 500,
        },
      }),
    );
  });
  const loan = await db.loan.findFirstOrThrow({
    where: { studentId: student.id, copyId: copies[0].id },
  });
  await db.loan.update({
    where: { id: loan.id },
    data: {
      issuedAt: new Date(Date.now() - 20 * DAY),
      dueAt: new Date(Date.now() - 4 * DAY),
    },
  });
  await test("return updates inventory and finalises grace-adjusted fine", async () => {
    const result = await returnBook(librarian, { id: loan.id });
    assert.equal(result.amount, 1500);
    assert.equal(
      (await db.bookCopy.findUniqueOrThrow({ where: { id: copies[0].id } }))
        .status,
      "AVAILABLE",
    );
    await assert.rejects(
      () => returnBook(librarian, { id: loan.id }),
      /already returned/,
    );
  });
  const fine = await db.fine.findUniqueOrThrow({ where: { loanId: loan.id } });
  await test("partial settlements, overpayment prevention and authorised waiver", async () => {
    await settleFine(librarian, {
      fineId: fine.id,
      amount: 500,
      reference: "TEST",
    });
    await assert.rejects(
      () => settleFine(librarian, { fineId: fine.id, amount: 1500 }),
      /exceeds/,
    );
    await assert.rejects(
      () =>
        settleFine(librarian, {
          fineId: fine.id,
          amount: 1000,
          waived: true,
          reason: "Test",
        }),
      /Administrator/,
    );
    await assert.rejects(
      () => settleFine(admin, { fineId: fine.id, amount: 1000, waived: true }),
      /reason/,
    );
    await settleFine(admin, {
      fineId: fine.id,
      amount: 1000,
      waived: true,
      reason: "Test waiver",
    });
    const record = (await getLoans(actor)).find((l) => l.id === loan.id)!;
    assert.equal(loanMoney(record).outstanding, 0);
  });
  await test("student borrowing queries never expose another student", async () => {
    const loans = await getLoans(actor);
    assert(loans.length > 0);
    assert(loans.every((l) => l.studentId === student.id));
    await assert.rejects(() => report(actor, {}), /Staff access/);
  });
  await test("accurate report totals and return-date filtering", async () => {
    const r = await report(admin, {});
    assert.equal(r.totals.titles, 1);
    assert.equal(r.totals.copies, 4);
    assert.equal(r.totals.available, 2);
    assert.equal(r.totals.issued, 2);
    assert.equal(r.totals.issues, 3);
    assert.equal(r.totals.returns, 1);
    assert.equal(r.totals.settled, 500);
    assert.equal(r.totals.waived, 1000);
    const today = new Date().toISOString().slice(0, 10);
    const todayReport = await report(admin, { start: today, end: today });
    assert.equal(todayReport.returns.length, 1);
    assert.equal(todayReport.loans.length, 2);
  });
  await test("inactive students and active-loan archival are rejected", async () => {
    await saveStudent(admin, {
      id: other.id,
      name: "Other Student",
      email: "other@test.local",
      rollNumber: "TEST-002",
      department: "CS",
      semester: 2,
      active: false,
    });
    await assert.rejects(
      () => issueBook(librarian, { studentId: other.id, copyId: copies[3].id }),
      /active student/,
    );
    await assert.rejects(
      () => mutate(admin, "archive-book", { id: book.id, archived: true }),
      /active copies/,
    );
  });
  console.log(`\n${passed} PostgreSQL integration scenarios passed.`);
} finally {
  await db.$disconnect();
  const cleanup = new PrismaClient({ datasourceUrl: baseUrl });
  await cleanup.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await cleanup.$disconnect();
}
