import Link from "next/link";
import { redirect } from "next/navigation";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManage } from "@/lib/rules";
import { studentFields } from "@/lib/fields";
import { ActionForm, ImportStudents } from "@/components/forms";
import { Badge, Empty, PageHeading, Pagination } from "@/components/ui";
export default async function Students({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const actor = await pageUser();
  if (!canManage(actor.role)) redirect("/dashboard");
  const params = await searchParams;
  const { q = "", status = "", department = "", sort = "name" } = params;
  const page = Math.max(1, Number(params.page) || 1);
  const where = {
    ...(department ? { department } : {}),
    ...(q
      ? {
          OR: [
            { rollNumber: { contains: q, mode: "insensitive" as const } },
            { user: { name: { contains: q, mode: "insensitive" as const } } },
            { user: { email: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(status ? { user: { active: status === "active" } } : {}),
  };
  const [students, total, departments] = await Promise.all([
    db.student.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, active: true } },
        _count: { select: { loans: { where: { returnedAt: null } } } },
      },
      skip: (page - 1) * 12,
      take: 12,
      orderBy:
        sort === "roll" ? { rollNumber: "asc" } : { user: { name: "asc" } },
    }),
    db.student.count({ where }),
    db.student.findMany({
      distinct: ["department"],
      select: { department: true },
    }),
  ]);
  return (
    <>
      <PageHeading
        title="The people behind the pages."
        description="Manage student accounts, borrowing history and campus membership."
        action={
          <>
            <ImportStudents />
            <ActionForm
              title="Register student"
              action="student"
              fields={studentFields}
              defaults={{ semester: 1, active: true }}
            />
          </>
        }
      />
      <form className="filter-bar">
        <input
          type="search"
          name="q"
          aria-label="Search students"
          defaultValue={q}
          placeholder="Search name, roll number or email…"
        />
        <select name="status" defaultValue={status} aria-label="Account status">
          <option value="">All accounts</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          name="department"
          defaultValue={department}
          aria-label="Department"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.department}>{d.department}</option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} aria-label="Sort students">
          <option value="name">Name A–Z</option>
          <option value="roll">Roll number</option>
        </select>
        <button className="button secondary">Apply</button>
      </form>
      <div className="panel">
        {students.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll number</th>
                  <th>Department</th>
                  <th>Semester</th>
                  <th>Active loans</th>
                  <th>Status</th>
                  <th>Profile</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.user.name}</strong>
                      <small>{s.user.email}</small>
                    </td>
                    <td>{s.rollNumber}</td>
                    <td>{s.department}</td>
                    <td>{s.semester}</td>
                    <td>{s._count.loans}</td>
                    <td>
                      <Badge tone={s.user.active ? "success" : "danger"}>
                        {s.user.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td>
                      <Link className="text-link" href={`/students/${s.id}`}>
                        View profile →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No students found" />
        )}
      </div>
      <Pagination total={total} page={page} query={params} />
      <p className="notice">
        CSV columns: name, email, rollNumber, department, semester, phone,
        password. Each new account requires a password of 12+ characters. Up to
        200 rows per import; invalid rows are reported individually.{" "}
        <a className="text-link" href="/students-template.csv" download>
          Download template
        </a>
      </p>
    </>
  );
}
