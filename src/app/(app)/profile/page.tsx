import { redirect } from "next/navigation";
import { pageUser } from "@/lib/auth";
import { PageHeading, Panel } from "@/components/ui";
export default async function Profile() {
  const actor = await pageUser();
  if (actor.student) redirect(`/students/${actor.student.id}`);
  return (
    <>
      <PageHeading
        title={actor.name}
        description="Your library team account."
      />
      <Panel title="Account details">
        <dl className="details">
          <div>
            <dt>Email address</dt>
            <dd>{actor.email}</dd>
          </div>
          <div>
            <dt>Access level</dt>
            <dd>{actor.role}</dd>
          </div>
          <div>
            <dt>Password changes</dt>
            <dd>Ask an administrator to update your account.</dd>
          </div>
        </dl>
      </Panel>
    </>
  );
}
