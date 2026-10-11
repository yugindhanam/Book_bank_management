import { pageUser } from "@/lib/auth";
import { getLoans, loanMoney } from "@/lib/queries";
import { canManage, date, money } from "@/lib/rules";
import { ActionForm } from "@/components/forms";
import { Badge, Empty, PageHeading, Panel, Pagination } from "@/components/ui";
export default async function Fines({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const actor = await pageUser();
  const params = await searchParams;
  const { q = "", status = "" } = params;
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const loans = (await getLoans(actor))
    .filter((l) => loanMoney(l).assessed > 0)
    .filter((l) =>
      `${l.student.user.name} ${l.copy.book.title}`
        .toLowerCase()
        .includes(q.toLowerCase()),
    )
    .filter(
      (l) =>
        !status ||
        (status === "outstanding"
          ? loanMoney(l).outstanding > 0
          : loanMoney(l).outstanding === 0),
    );
  return (
    <>
      <PageHeading
        title="Clear balances. Fresh chapters."
        description="Record settlements and authorised waivers. No online payment gateway is connected."
      />
      <form className="filter-bar">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search student or title…"
          aria-label="Search fines"
        />
        <select name="status" defaultValue={status} aria-label="Fine status">
          <option value="">All balances</option>
          <option value="outstanding">Outstanding</option>
          <option value="settled">Settled</option>
        </select>
        <button className="button secondary">Apply</button>
      </form>
      <Panel title="Fines & recorded settlements">
        <div className="report-summary">
          <div>
            <span>Assessed / accrued</span>
            {money(loans.reduce((s, l) => s + loanMoney(l).assessed, 0))}
          </div>
          <div>
            <span>Outstanding</span>
            {money(loans.reduce((s, l) => s + loanMoney(l).outstanding, 0))}
          </div>
          <div>
            <span>Settled or waived</span>
            {money(loans.reduce((s, l) => s + loanMoney(l).settled, 0))}
          </div>
        </div>
        {loans.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Borrower / book</th>
                  <th>Chargeable fine</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Settlement history</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loans.slice((page - 1) * 12, page * 12).map((l) => {
                  const m = loanMoney(l);
                  const waived = l.fine?.settlements.some((s) => s.waived);
                  return (
                    <tr key={l.id}>
                      <td>
                        <strong>{l.student.user.name}</strong>
                        <small>{l.copy.book.title}</small>
                      </td>
                      <td>
                        {money(m.assessed)}
                        <small>
                          {m.days} days overdue · {money(l.dailyFine)}/day
                        </small>
                      </td>
                      <td>{money(m.outstanding)}</td>
                      <td>
                        <Badge tone={m.outstanding ? "warning" : "success"}>
                          {!l.returnedAt
                            ? "Accruing"
                            : !m.outstanding
                              ? waived
                                ? "Settled / waived"
                                : "Paid"
                              : m.settled
                                ? "Partially paid"
                                : "Outstanding"}
                        </Badge>
                      </td>
                      <td>
                        {l.fine?.settlements.map((s) => (
                          <small key={s.id}>
                            {money(s.amount)} {s.waived ? "waived" : "recorded"}{" "}
                            · {date(s.createdAt)}
                            <br />
                            {s.recordedBy.name}
                            {s.reference ? ` · ${s.reference}` : ""}
                            {s.reason ? ` · ${s.reason}` : ""}
                          </small>
                        ))}
                      </td>
                      <td>
                        {canManage(actor.role) &&
                        l.fine &&
                        m.outstanding > 0 ? (
                          <ActionForm
                            title="Record settlement"
                            secondary
                            action="settle"
                            defaults={{
                              fineId: l.fine.id,
                              amount: m.outstanding,
                              waived: false,
                            }}
                            description={`Balance: ${money(m.outstanding)}. Enter the amount in paise (₹1 = 100 paise).`}
                            fields={[
                              {
                                name: "amount",
                                label: "Amount (paise)",
                                type: "number",
                                min: 1,
                                max: m.outstanding,
                                required: true,
                              },
                              { name: "reference", label: "Reference number" },
                              ...(actor.role === "ADMIN"
                                ? [
                                    {
                                      name: "waived",
                                      label: "Record as waiver",
                                      type: "checkbox",
                                    },
                                  ]
                                : []),
                              {
                                name: "reason",
                                label: "Reason (required for waiver)",
                                type: "textarea",
                              },
                            ]}
                          />
                        ) : !l.returnedAt ? (
                          <span className="muted">Return to finalise</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No fines to show"
            text="There are no matching overdue charges."
          />
        )}
      </Panel>
      <Pagination page={page} total={loans.length} query={params} />
    </>
  );
}
