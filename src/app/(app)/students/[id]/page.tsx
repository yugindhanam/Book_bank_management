import { notFound } from "next/navigation";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManage, date, money } from "@/lib/rules";
import { loanInclude, loanMoney } from "@/lib/queries";
import { studentFields } from "@/lib/fields";
import { ActionForm } from "@/components/forms";
import { PageHeading, Panel } from "@/components/ui";
import { LoanTable } from "@/components/loan-table";
export default async function StudentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageUser();
  const { id } = await params;
  if (!canManage(actor.role) && actor.student?.id !== id) notFound();
  const student = await db.student.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, active: true } },
      loans: { include: loanInclude, orderBy: { issuedAt: "desc" } },
    },
  });
  if (!student) notFound();
  return (
    <>
      <PageHeading
        title={student.user.name}
        description={`${student.rollNumber} · ${student.department}`}
        action={
          canManage(actor.role) && (
            <ActionForm
              title="Edit student"
              action="student"
              secondary
              fields={studentFields}
              defaults={{
                id: student.id,
                name: student.user.name,
                email: student.user.email,
                active: student.user.active,
                rollNumber: student.rollNumber,
                department: student.department,
                semester: student.semester,
                phone: student.phone || "",
              }}
            />
          )
        }
      />
      <Panel title="Student profile">
        <dl className="details">
          {[
            ["Email", student.user.email],
            ["Semester", student.semester],
            ["Contact", student.phone || "—"],
            ["Registered", date(student.createdAt)],
            ["Account", student.user.active ? "Active" : "Inactive"],
            [
              "Outstanding fines",
              money(
                student.loans.reduce((s, l) => s + loanMoney(l).outstanding, 0),
              ),
            ],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <div className="section-gap">
        <Panel title="Borrowing history">
          <LoanTable loans={student.loans} staff={canManage(actor.role)} />
        </Panel>
      </div>
    </>
  );
}
