import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { scoped } from "@/lib/queries";
import { date, overdueDays, dueDate } from "@/lib/rules";
import { ActionButton } from "@/components/forms";
import { PageHeading, Panel, Badge, Empty } from "@/components/ui";
export default async function Notifications() {
  const actor = await pageUser();
  const [notifications, loans] = await Promise.all([
    db.notification.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.loan.findMany({
      where: {
        ...scoped(actor),
        returnedAt: null,
        dueAt: { lte: dueDate(new Date(), 2) },
      },
      include: { copy: { include: { book: true } } },
    }),
  ]);
  return (
    <>
      <PageHeading
        title="A note from your library."
        description="Request updates, circulation confirmations and timely borrowing reminders."
        action={
          <ActionButton
            action="read-notifications"
            data={{}}
            label="Mark all as read"
          />
        }
      />
      <Panel title="Due-date reminders">
        <div className="notification-list">
          {loans.map((l) => (
            <div className="notification-row" key={l.id}>
              <Badge tone={overdueDays(l.dueAt) ? "danger" : "warning"}>
                {overdueDays(l.dueAt) ? "Overdue" : "Due soon"}
              </Badge>{" "}
              {l.copy.book.title} · {l.copy.accession}
              <small>Due {date(l.dueAt)}. Please arrange a return.</small>
            </div>
          ))}
          {!loans.length && (
            <Empty
              title="No upcoming deadlines"
              text="You’re all caught up with borrowing reminders."
            />
          )}
        </div>
      </Panel>
      <div className="section-gap">
        <Panel title="Your updates">
          <div className="notification-list">
            {notifications.map((n) => (
              <div className="notification-row" key={n.id}>
                {!n.read && <Badge tone="info">New</Badge>} {n.message}
                <small>{date(n.createdAt)}</small>
              </div>
            ))}
            {!notifications.length && <Empty title="No notifications yet" />}
          </div>
        </Panel>
      </div>
    </>
  );
}
