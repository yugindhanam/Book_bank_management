import Link from "next/link";
import { Badge, BookCover, Empty } from "./ui";
import { ActionForm } from "./forms";
import { date, money } from "@/lib/rules";
import { loanMoney, type LoanRecord } from "@/lib/queries";
export function LoanTable({
  loans,
  staff = false,
  compact = false,
}: {
  loans: LoanRecord[];
  staff?: boolean;
  compact?: boolean;
}) {
  if (!loans.length)
    return (
      <Empty
        title="No loans to show"
        text="Issued books and borrowing history will appear here."
      />
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Book / accession</th>
            <th>Borrower</th>
            {!compact && <th>Issued on</th>}
            <th>Due date</th>
            <th>Status</th>
            {!compact && (
              <>
                <th>Fine</th>
                <th>Transaction</th>
              </>
            )}
            {staff && !compact && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {loans.map((l) => {
            const amount = loanMoney(l);
            return (
              <tr key={l.id}>
                <td>
                  <Link href={`/books/${l.copy.bookId}`} className="table-book">
                    <BookCover
                      title={l.copy.book.title}
                      author={l.copy.book.author}
                      small
                    />
                    <span>
                      <strong>{l.copy.book.title}</strong>
                      <small>{l.copy.accession}</small>
                    </span>
                  </Link>
                </td>
                <td>
                  <strong>{l.student.user.name}</strong>
                  <small>{l.student.rollNumber}</small>
                </td>
                {!compact && (
                  <td>
                    {date(l.issuedAt)}
                    <small>By {l.issuedBy.name}</small>
                  </td>
                )}
                <td>{date(l.dueAt)}</td>
                <td>
                  <Badge
                    tone={
                      l.returnedAt
                        ? "success"
                        : amount.days
                          ? "danger"
                          : "warning"
                    }
                  >
                    {l.returnedAt
                      ? "Returned"
                      : amount.days
                        ? `${amount.days} days overdue`
                        : "Issued"}
                  </Badge>
                  {l.returnedAt && <small>{date(l.returnedAt)}</small>}
                </td>
                {!compact && (
                  <>
                    <td>
                      {money(amount.outstanding)}
                      <small>{l.returnedAt ? "Outstanding" : "Accrued"}</small>
                    </td>
                    <td>
                      <small title={l.id}>{l.id.slice(-9).toUpperCase()}</small>
                    </td>
                  </>
                )}
                {staff && !compact && (
                  <td>
                    {!l.returnedAt && (
                      <ActionForm
                        title="Process return"
                        trigger="Return"
                        secondary
                        action="return"
                        defaults={{ id: l.id, condition: "AVAILABLE" }}
                        description={`${l.copy.book.title} · ${l.student.user.name}. Current estimated fine: ${money(amount.assessed)}. The final amount uses the actual return date.`}
                        fields={[
                          {
                            name: "returnedAt",
                            label: "Actual return date and time",
                            type: "datetime-local",
                            help: "Leave blank to record the current time.",
                          },
                          {
                            name: "condition",
                            label: "Copy condition after return",
                            type: "select",
                            required: true,
                            options: [
                              { value: "AVAILABLE", label: "Available" },
                              {
                                value: "MAINTENANCE",
                                label: "Under maintenance",
                              },
                              { value: "LOST", label: "Lost" },
                            ],
                          },
                        ]}
                      />
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
