import { pageUser } from "@/lib/auth";
import { getLoans } from "@/lib/queries";
import { canManage, overdueDays } from "@/lib/rules";
import { PageHeading, Panel, Pagination } from "@/components/ui";
import { LoanTable } from "@/components/loan-table";
export default async function Overdue({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const actor = await pageUser();
  const params = await searchParams;
  const q = params.q ?? "";
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const loans = (await getLoans(actor)).filter(
    (l) =>
      !l.returnedAt &&
      overdueDays(l.dueAt) > 0 &&
      `${l.student.user.name} ${l.student.rollNumber} ${l.copy.book.title} ${l.copy.accession}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="A little overdue attention."
        description="Live overdue status, calculated from each loan’s due date. Fines accrue by UTC calendar day."
      />
      <form className="filter-bar">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Search overdue loans"
          placeholder="Search student, title or accession…"
        />
        <button className="button secondary">Search</button>
      </form>
      <Panel
        title={`${loans.length} overdue loans`}
        subtitle="Return a book to finalise its fine before recording a settlement."
      >
        <LoanTable
          loans={loans.slice((page - 1) * 12, page * 12)}
          staff={canManage(actor.role)}
        />
      </Panel>
      <Pagination page={page} total={loans.length} query={params} />
    </>
  );
}
