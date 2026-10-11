import Link from "next/link";
import { Prisma } from "@prisma/client";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManage } from "@/lib/rules";
import { bookFields } from "@/lib/fields";
import { ActionForm, ActionButton } from "@/components/forms";
import {
  Badge,
  BookCover,
  Empty,
  PageHeading,
  Pagination,
} from "@/components/ui";
export default async function Books({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await pageUser();
  const params = await searchParams;
  const {
    q = "",
    category = "",
    availability = "",
    sort = "title",
    view = "grid",
    archive = "",
  } = params;
  const page = Math.max(1, Number(params.page) || 1);
  const categories = await db.category.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
  });
  const where: Prisma.BookWhereInput = {
    archived: canManage(user.role) && archive === "yes",
    ...(category ? { categoryId: category } : {}),
    ...(availability === "available"
      ? { copies: { some: { status: "AVAILABLE" } } }
      : availability === "unavailable"
        ? { copies: { none: { status: "AVAILABLE" } } }
        : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { author: { contains: q, mode: "insensitive" } },
            { isbn: { contains: q, mode: "insensitive" } },
            {
              copies: {
                some: { accession: { contains: q, mode: "insensitive" } },
              },
            },
            { category: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [books, total] = await Promise.all([
    db.book.findMany({
      where,
      include: { category: true, copies: true },
      orderBy:
        sort === "newest"
          ? { createdAt: "desc" }
          : sort === "author"
            ? { author: "asc" }
            : { title: "asc" },
      skip: (page - 1) * 12,
      take: 12,
    }),
    db.book.count({ where }),
  ]);
  return (
    <>
      <PageHeading
        eyebrow="THE COLLECTION"
        title="A shelf for every curiosity."
        description="Discover, organise and keep your campus collection in circulation."
        action={
          canManage(user.role) && (
            <ActionForm
              title="Add a book"
              action="book"
              fields={bookFields(categories)}
              defaults={{ copies: 1 }}
            />
          )
        }
      />
      <form className="filter-bar">
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search title, author, ISBN or accession…"
          aria-label="Search books"
        />
        <select name="category" defaultValue={category} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="availability"
          defaultValue={availability}
          aria-label="Availability"
        >
          <option value="">All availability</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
        <select name="sort" defaultValue={sort} aria-label="Sort books">
          <option value="title">Title A–Z</option>
          <option value="author">Author A–Z</option>
          <option value="newest">Newest first</option>
        </select>
        <select name="view" defaultValue={view} aria-label="Display mode">
          <option value="grid">Grid view</option>
          <option value="list">List view</option>
        </select>
        {canManage(user.role) && (
          <select
            name="archive"
            defaultValue={archive}
            aria-label="Archived books"
          >
            <option value="">Active titles</option>
            <option value="yes">Archived titles</option>
          </select>
        )}
        <button className="button secondary">Apply</button>
      </form>
      {!books.length ? (
        <Empty
          title="No books found"
          text="Try a different search or add the first title to your collection."
        />
      ) : view === "list" ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Category</th>
                <th>Availability</th>
                <th>Shelf</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/books/${b.id}`}>
                      <strong>{b.title}</strong>
                      <small>{b.isbn || "No ISBN"}</small>
                    </Link>
                  </td>
                  <td>{b.author}</td>
                  <td>{b.category.name}</td>
                  <td>
                    {b.copies.filter((c) => c.status === "AVAILABLE").length} /{" "}
                    {b.copies.length}
                  </td>
                  <td>{b.shelf}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="catalogue-grid">
          {books.map((b) => {
            const available = b.copies.filter(
              (c) => c.status === "AVAILABLE",
            ).length;
            return (
              <article className="book-card" key={b.id}>
                <Link href={`/books/${b.id}`} aria-label={`View ${b.title}`}>
                  <BookCover
                    title={b.title}
                    author={b.author}
                    category={b.category.name}
                    coverUrl={b.coverUrl}
                  />
                </Link>
                <Link href={`/books/${b.id}`}>
                  <h2>{b.title}</h2>
                </Link>
                <p>{b.author}</p>
                <div className="book-card-footer">
                  <Badge tone={available ? "success" : "warning"}>
                    {available ? `${available} available` : "All borrowed"}
                  </Badge>
                  {user.role === "STUDENT" && available ? (
                    <ActionButton
                      label="Request"
                      action="request"
                      data={{ bookId: b.id }}
                    />
                  ) : (
                    <Link href={`/books/${b.id}`}>View details →</Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Pagination page={page} total={total} query={params} />
    </>
  );
}
