import { redirect } from "next/navigation";
import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/rules";
import { ActionForm } from "@/components/forms";
import { PageHeading, Panel } from "@/components/ui";
export default async function Settings() {
  const actor = await pageUser();
  if (actor.role !== "ADMIN") redirect("/dashboard");
  const settings = (await db.librarySettings.findUnique({
    where: { id: "library" },
  })) ?? {
    name: "LICET Book Bank",
    loanDays: 14,
    maxLoans: 3,
    dailyFine: 500,
    graceDays: 0,
  };
  return (
    <>
      <PageHeading
        title="Your library, your rules."
        description="Configure borrowing terms. Updated rules apply to newly issued loans."
        action={
          <ActionForm
            title="Update library settings"
            action="settings"
            defaults={settings}
            fields={[
              { name: "name", label: "Library name", required: true },
              {
                name: "loanDays",
                label: "Loan duration (days)",
                type: "number",
                required: true,
                min: 1,
                max: 365,
              },
              {
                name: "maxLoans",
                label: "Maximum active loans",
                type: "number",
                required: true,
                min: 1,
                max: 30,
              },
              {
                name: "dailyFine",
                label: "Daily fine (paise)",
                type: "number",
                required: true,
                min: 0,
                max: 100000,
                help: "100 paise = ₹1",
              },
              {
                name: "graceDays",
                label: "Grace period (days)",
                type: "number",
                required: true,
                min: 0,
                max: 30,
              },
            ]}
          />
        }
      />
      <Panel title="Borrowing policy">
        <dl className="details">
          {[
            ["Library", settings.name],
            ["Loan period", `${settings.loanDays} days`],
            ["Borrowing limit", `${settings.maxLoans} books`],
            ["Daily overdue fine", money(settings.dailyFine)],
            ["Grace period", `${settings.graceDays} days`],
            ["Time convention", "UTC calendar days"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <div className="notice section-gap">
        Fine = max(0, calendar days after due date − grace days) × daily rate.
        The entire due date is free. Terms are snapshotted at issue time. A
        returned loan’s fine is fixed; active loans show accrued estimates.
        Money is stored as integer paise.
      </div>
    </>
  );
}
