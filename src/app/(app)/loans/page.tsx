import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLoans } from "@/lib/queries";
import { canManage, money, date, dueDate } from "@/lib/rules";
import { ActionForm } from "@/components/forms";
import { PageHeading, Panel, Pagination } from "@/components/ui";
import { LoanTable } from "@/components/loan-table";
export default async function Loans({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const actor = await pageUser();
  const params = await searchParams;
  const { q = "", status = "" } = params;
  const page = Math.max(1, Number(params.page) || 1);
  const staff = canManage(actor.role);
  const [all, students, copies, requests, settings] = await Promise.all([
    getLoans(actor),
    staff
      ? db.student.findMany({
          where: { user: { active: true } },
          include: { user: { select: { name: true } } },
          orderBy: { user: { name: "asc" } },
        })
      : [],
    staff
      ? db.bookCopy.findMany({
          where: { status: "AVAILABLE", book: { archived: false } },
          include: { book: true },
          orderBy: { book: { title: "asc" } },
        })
      : [],
    staff
      ? db.bookRequest.findMany({
          where: { status: "APPROVED" },
          include: {
            book: true,
            student: { include: { user: { select: { name: true } } } },
          },
        })
      : [],
    db.librarySettings.findUnique({ where: { id: "library" } }),
  ]);
  const filtered = all.filter(
    (l) =>
      (!status || (status === "active" ? !l.returnedAt : !!l.returnedAt)) &&
      `${l.id} ${l.student.user.name} ${l.student.rollNumber} ${l.copy.accession} ${l.copy.book.title}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title={staff ? "Good books, on the move." : "Your reading journey."}
        description="Issue with confidence. Return with clarity. Every transaction, in one place."
        action={
          staff && (
            <ActionForm
              title="Issue a book"
              action="issue"
              description={`Issue date: ${date(new Date())}. Due: ${date(dueDate(new Date(), settings?.loanDays ?? 14))}. Select a student and available copy. Limit: ${settings?.maxLoans ?? 3} active loans. Fine: ${money(settings?.dailyFine ?? 500)} per day after ${settings?.graceDays ?? 0} grace days. Confirm & save commits the issue.`}
              fields={[
                {
                  name: "studentId",
                  label: "Student",
                  type: "select",
                  required: true,
                  options: students.map((s) => ({
                    value: s.id,
                    label: `${s.user.name} · ${s.rollNumber}`,
                  })),
                },
                {
                  name: "copyId",
                  label: "Available physical copy",
                  type: "select",
                  required: true,
                  options: copies.map((c) => ({
                    value: c.id,
                    label: `${c.book.title} · ${c.accession}`,
                  })),
                },
                {
                  name: "requestId",
                  label: "Fulfil approved request (optional)",
                  type: "select",
                  options: requests.map((r) => ({
                    value: r.id,
                    label: `${r.student.user.name} · ${r.book.title}`,
                  })),
                },
              ]}
            />
          )
        }
      />
      <form className="filter-bar">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Search loans"
          placeholder="Search borrower, book, accession or transaction…"
        />
        <select name="status" defaultValue={status} aria-label="Loan status">
          <option value="">All transactions</option>
          <option value="active">Active loans</option>
          <option value="returned">Returned</option>
        </select>
        <button className="button secondary">Apply</button>
      </form>
      <Panel
        title="Circulation history"
        subtitle={`${filtered.length} matching transactions`}
      >
        <LoanTable
          loans={filtered.slice((page - 1) * 12, page * 12)}
          staff={staff}
        />
      </Panel>
      <Pagination page={page} total={filtered.length} query={params} />
    </>
  );
}
