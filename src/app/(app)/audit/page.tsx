import { redirect } from "next/navigation";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { date } from "@/lib/rules";
import { PageHeading, Pagination, Empty } from "@/components/ui";
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const actor = await pageUser();
  if (actor.role !== "ADMIN") redirect("/dashboard");
  const params = await searchParams;
  const q = params.q || "";
  const page = Math.max(1, Number(params.page) || 1);
  const where = {
    OR: [
      { action: { contains: q, mode: "insensitive" as const } },
      { detail: { contains: q, mode: "insensitive" as const } },
      { recordId: { contains: q, mode: "insensitive" as const } },
      { user: { name: { contains: q, mode: "insensitive" as const } } },
    ],
  };
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 12,
      skip: (page - 1) * 12,
    }),
    db.auditLog.count({ where }),
  ]);
  return (
    <>
      <PageHeading
        title="Every action, accounted for."
        description="A searchable record of significant changes. Passwords and session tokens are never logged."
      />
      <form className="filter-bar">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search action, person or record…"
          aria-label="Search audit log"
        />
        <button className="button secondary">Search</button>
      </form>
      <div className="panel table-wrap">
        {logs.length ? (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Responsible user</th>
                <th>Action</th>
                <th>Affected record</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>
                    {date(l.createdAt)}
                    <small>{l.createdAt.toISOString().slice(11, 19)} UTC</small>
                  </td>
                  <td>{l.user.name}</td>
                  <td>{l.action.replaceAll("_", " ")}</td>
                  <td>
                    <small>{l.recordId}</small>
                  </td>
                  <td>{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty />
        )}
      </div>
      <Pagination total={total} page={page} query={params} />
    </>
  );
}
