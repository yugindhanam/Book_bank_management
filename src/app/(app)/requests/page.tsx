import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoped } from "@/lib/queries";
import { canManage, date } from "@/lib/rules";
import { ActionButton, ActionForm } from "@/components/forms";
import { Badge, Empty, PageHeading, Pagination } from "@/components/ui";
export default async function Requests({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const actor = await pageUser();
  const params = await searchParams;
  const { status = "", q = "" } = params;
  const page = Math.max(1, Number(params.page) || 1);
  const requests = await db.bookRequest.findMany({
    where: scoped(actor),
    include: {
      book: true,
      student: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  const filtered = requests.filter(
    (r) =>
      (!status || r.status === status) &&
      `${r.book.title} ${r.student.user.name}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const staff = canManage(actor.role);
  return (
    <>
      <PageHeading
        title="The next read starts here."
        description="Review, track and fulfil book requests. Approval does not reserve a physical copy."
        action={
          <Link className="button" href="/books">
            Browse catalogue
          </Link>
        }
      />
      <form className="filter-bar">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search requests…"
          aria-label="Search requests"
        />
        <select name="status" defaultValue={status} aria-label="Request status">
          <option value="">All statuses</option>
          {["PENDING", "APPROVED", "REJECTED", "CANCELLED", "FULFILLED"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
        <button className="button secondary">Apply</button>
      </form>
      <div className="panel">
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Requested by</th>
                  <th>Requested on</th>
                  <th>Status / reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page - 1) * 12, page * 12).map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/books/${r.bookId}`}>
                        <strong>{r.book.title}</strong>
                        <small>{r.book.author}</small>
                      </Link>
                    </td>
                    <td>
                      {r.student.user.name}
                      <small>{r.student.rollNumber}</small>
                    </td>
                    <td>{date(r.createdAt)}</td>
                    <td>
                      <Badge
                        tone={
                          r.status === "APPROVED" || r.status === "FULFILLED"
                            ? "success"
                            : r.status === "REJECTED"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {r.status}
                      </Badge>
                      <small>{r.reason}</small>
                    </td>
                    <td>
                      <div className="row-actions">
                        {staff && r.status === "PENDING" && (
                          <>
                            <ActionButton
                              label="Approve"
                              action="review"
                              data={{ id: r.id, status: "APPROVED" }}
                            />
                            <ActionForm
                              secondary
                              title="Reject request"
                              trigger="Reject"
                              action="review"
                              defaults={{ id: r.id, status: "REJECTED" }}
                              fields={[
                                {
                                  name: "reason",
                                  label: "Reason (optional)",
                                  type: "textarea",
                                },
                              ]}
                            />
                          </>
                        )}
                        {staff && r.status === "APPROVED" && (
                          <Link
                            href="/loans"
                            className="button secondary compact"
                          >
                            Issue copy
                          </Link>
                        )}
                        {["PENDING", "APPROVED"].includes(r.status) && (
                          <ActionButton
                            action="review"
                            label="Cancel"
                            data={{ id: r.id, status: "CANCELLED" }}
                            confirm="Cancel this request?"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No requests found"
            text="Students can request an available title from the catalogue."
          />
        )}
      </div>
      <Pagination total={filtered.length} page={page} query={params} />
    </>
  );
}
