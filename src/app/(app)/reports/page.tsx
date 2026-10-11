import { redirect } from "next/navigation";
import { pageUser } from "@/lib/auth";
import { report } from "@/lib/reports";
import { canManage, money } from "@/lib/rules";
import { PageHeading, Panel, Empty } from "@/components/ui";
import { PrintButton } from "@/components/forms";
import { ActivityChart } from "@/components/charts";
import { LoanTable } from "@/components/loan-table";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const actor = await pageUser();
  if (!canManage(actor.role)) redirect("/dashboard");
  const params = await searchParams;
  let data;
  try {
    data = await report(actor, params);
  } catch {
    return (
      <>
        <PageHeading
          title="Reports & analytics"
          description="Choose a valid start and end date."
        />
        <a className="button" href="/reports">
          Reset filters
        </a>
      </>
    );
  }
  const query = new URLSearchParams(params).toString();
  return (
    <>
      <PageHeading
        title="The story behind your shelves."
        description="Understand circulation, collection health and the readers who bring it to life."
        action={
          <>
            <PrintButton />
            <a className="button" href={`/api/reports?${query}`}>
              Export issues CSV
            </a>
            <a
              className="button secondary"
              href={`/api/reports?${query}&type=returns`}
            >
              Returns CSV
            </a>
          </>
        }
      />
      <form className="filter-bar">
        <label>
          From
          <input type="date" name="start" defaultValue={params.start} />
        </label>
        <label>
          Through
          <input type="date" name="end" defaultValue={params.end} />
        </label>
        <input
          type="search"
          name="q"
          defaultValue={params.q}
          placeholder="Filter by book, student or roll number…"
          aria-label="Search reports"
        />
        <button className="button secondary">Apply range</button>
      </form>
      <div className="notice">
        Issue and return activity and recorded settlements use the selected date
        range. Inventory, overdue loans and outstanding balances are current
        snapshots. Search filters borrowing records; inventory remains
        library-wide.
      </div>
      <div className="stats-grid">
        {Object.entries({
          Titles: data.totals.titles,
          "Physical copies": data.totals.copies,
          Available: data.totals.available,
          Issued: data.totals.issued,
          "Issues in range": data.totals.issues,
          "Returns in range": data.totals.returns,
          "Current overdue": data.totals.overdue,
          "Current outstanding": money(data.totals.outstanding),
        }).map(([k, v]) => (
          <div className="stat-card" key={k}>
            <div className="stat-top">{k}</div>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <Panel title="Monthly issue & return activity">
          <ActivityChart data={data.trend} />
          {!data.trend.length && (
            <p className="px-6 pb-5 muted text-xs">
              No activity in this range.
            </p>
          )}
        </Panel>
        <Panel title="Settlement summary">
          <dl className="details">
            <div>
              <dt>Recorded payments</dt>
              <dd>{money(data.totals.settled)}</dd>
            </div>
            <div>
              <dt>Waived</dt>
              <dd>{money(data.totals.waived)}</dd>
            </div>
          </dl>
        </Panel>
      </div>
      <div className="dashboard-columns">
        <Panel title="Frequently borrowed titles">
          <div className="request-list">
            {data.popular.slice(0, 8).map(([name, count]) => (
              <div className="request-item" key={name}>
                <strong>{name}</strong>
                <span className="ml-auto muted text-xs">{count} borrows</span>
              </div>
            ))}
            {!data.popular.length && <Empty />}
          </div>
        </Panel>
        <Panel title="Most active readers">
          <div className="request-list">
            {data.borrowers.slice(0, 8).map(([name, count]) => (
              <div className="request-item" key={name}>
                <strong>{name}</strong>
                <span className="ml-auto muted text-xs">{count} borrows</span>
              </div>
            ))}
            {!data.borrowers.length && <Empty />}
          </div>
        </Panel>
      </div>
      <Panel title="Category-wise inventory">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Titles</th>
                <th>Copies</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.books.length}</td>
                  <td>{c.books.reduce((s, b) => s + b.copies.length, 0)}</td>
                  <td>
                    {c.books.reduce(
                      (s, b) =>
                        s +
                        b.copies.filter((copy) => copy.status === "AVAILABLE")
                          .length,
                      0,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="section-gap">
        <Panel title="Issues in selected range">
          <LoanTable loans={data.loans} />
        </Panel>
      </div>
      <div className="section-gap">
        <Panel title="Returns in selected range">
          <LoanTable loans={data.returns} />
        </Panel>
      </div>
    </>
  );
}
