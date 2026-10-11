import { redirect } from "next/navigation";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { staffFields } from "@/lib/fields";
import { ActionForm } from "@/components/forms";
import { Badge, PageHeading } from "@/components/ui";
export default async function Users() {
  const actor = await pageUser();
  if (actor.role !== "ADMIN") redirect("/dashboard");
  const users = await db.user.findMany({
    where: { role: { in: ["ADMIN", "LIBRARIAN"] } },
    select: { id: true, name: true, email: true, role: true, active: true },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeading
        title="A trusted team, together."
        description="Manage staff access. Student accounts are managed in the Students module."
        action={
          <ActionForm
            title="Add team member"
            action="staff"
            fields={staffFields}
            defaults={{ role: "LIBRARIAN", active: true }}
          />
        }
      />
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Team member</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                </td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>
                  <Badge tone={u.active ? "success" : "danger"}>
                    {u.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td>
                  <ActionForm
                    title="Edit team member"
                    secondary
                    action="staff"
                    fields={staffFields}
                    defaults={u}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
