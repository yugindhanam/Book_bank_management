import Link from "next/link";
import { notFound } from "next/navigation";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManage, overdueDays } from "@/lib/rules";
import { bookFields } from "@/lib/fields";
import { ActionForm, ActionButton } from "@/components/forms";
import { Badge, BookCover, PageHeading, Panel } from "@/components/ui";
export default async function BookDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await pageUser();
  const { id } = await params;
  const book = await db.book.findUnique({
    where: { id },
    include: {
      category: true,
      copies: {
        include: {
          loans: { where: { returnedAt: null }, select: { dueAt: true } },
        },
        orderBy: { accession: "asc" },
      },
    },
  });
  if (!book || (book.archived && !canManage(user.role))) notFound();
  const categories = await db.category.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
  });
  const staff = canManage(user.role);
  const statusOptions = [
    { value: "AVAILABLE", label: "Available" },
    { value: "MAINTENANCE", label: "Under maintenance" },
    { value: "LOST", label: "Lost" },
  ];
  return (
    <>
      <Link href="/books" className="text-link mb-5">
        ← Back to catalogue
      </Link>
      <PageHeading
        title={book.title}
        description={`${book.author} · ${book.category.name}`}
        action={
          staff ? (
            <>
              <ActionForm
                title="Edit book"
                secondary
                action="book"
                fields={bookFields(categories, true)}
                defaults={{
                  ...book,
                  copies: 1,
                  isbn: book.isbn || "",
                  year: book.year ?? "",
                  coverUrl: book.coverUrl || "",
                }}
              />
              <ActionButton
                action="archive-book"
                label={book.archived ? "Restore" : "Archive"}
                data={{ id, archived: !book.archived }}
                confirm={
                  book.archived
                    ? "Restore this title to the catalogue?"
                    : "Archive this title? Historical records will be preserved."
                }
              />
            </>
          ) : (
            <ActionButton
              action="request"
              label="Request this book"
              data={{ bookId: id }}
            />
          )
        }
      />
      <div className="detail-layout">
        <div className="detail-cover">
          <BookCover
            title={book.title}
            author={book.author}
            category={book.category.name}
            coverUrl={book.coverUrl}
          />
        </div>
        <Panel title="About this title">
          <p className="px-6 text-sm leading-7 muted">
            {book.description ||
              "No description has been added for this title."}
          </p>
          <dl className="details">
            {[
              ["ISBN", book.isbn || "Not provided"],
              ["Publisher", book.publisher || "—"],
              ["Edition", book.edition || "—"],
              ["Published", book.year || "—"],
              ["Shelf", book.shelf],
              [
                "Copies available",
                `${book.copies.filter((c) => c.status === "AVAILABLE").length} of ${book.copies.length}`,
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
      <div className="section-gap">
        <Panel
          title="Physical copies"
          subtitle="Every copy has a unique accession number"
        >
          <div className="px-6 pb-4">
            {staff && (
              <ActionForm
                title="Add physical copy"
                action="copy"
                defaults={{ bookId: id, status: "AVAILABLE" }}
                fields={[
                  {
                    name: "accession",
                    label: "Unique accession / barcode",
                    required: true,
                  },
                  {
                    name: "status",
                    label: "Condition",
                    type: "select",
                    options: statusOptions,
                    required: true,
                  },
                ]}
              />
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Accession number</th>
                  <th>Status</th>
                  <th>Shelf</th>
                  {staff && <th>Manage</th>}
                </tr>
              </thead>
              <tbody>
                {book.copies.map((c) => {
                  const overdue =
                    c.loans[0] && overdueDays(c.loans[0].dueAt) > 0;
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.accession}</strong>
                      </td>
                      <td>
                        <Badge
                          tone={
                            c.status === "AVAILABLE"
                              ? "success"
                              : overdue
                                ? "danger"
                                : "warning"
                          }
                        >
                          {overdue ? "OVERDUE" : c.status}
                        </Badge>
                      </td>
                      <td>{book.shelf}</td>
                      {staff && (
                        <td>
                          {c.status !== "ISSUED" && (
                            <ActionForm
                              title="Edit copy"
                              secondary
                              action="copy"
                              defaults={{
                                id: c.id,
                                bookId: id,
                                accession: c.accession,
                                status: c.status,
                              }}
                              fields={[
                                {
                                  name: "accession",
                                  label: "Accession number",
                                  required: true,
                                },
                                {
                                  name: "status",
                                  label: "Condition",
                                  type: "select",
                                  required: true,
                                  options: statusOptions,
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
        </Panel>
      </div>
    </>
  );
}
