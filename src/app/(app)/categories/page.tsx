import { redirect } from "next/navigation";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManage } from "@/lib/rules";
import { categoryFields } from "@/lib/fields";
import { ActionForm } from "@/components/forms";
import { PageHeading, Badge, Empty } from "@/components/ui";
export default async function Categories() {
  const actor = await pageUser();
  if (!canManage(actor.role)) redirect("/dashboard");
  const categories = await db.category.findMany({
    include: { _count: { select: { books: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeading
        title="A place for every subject."
        description="Organise the collection into meaningful categories. Archive categories to retain historical references."
        action={
          <ActionForm
            title="Add category"
            action="category"
            fields={categoryFields}
          />
        }
      />
      <div className="panel">
        {categories.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Titles</th>
                  <th>Status</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>{c.description}</td>
                    <td>{c._count.books}</td>
                    <td>
                      <Badge tone={c.archived ? "warning" : "success"}>
                        {c.archived ? "Archived" : "Active"}
                      </Badge>
                    </td>
                    <td>
                      <ActionForm
                        title="Edit category"
                        secondary
                        action="category"
                        fields={categoryFields}
                        defaults={{
                          id: c.id,
                          name: c.name,
                          description: c.description,
                          archived: c.archived,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Start with a subject"
            text="Add a category before creating your first book."
          />
        )}
      </div>
    </>
  );
}
