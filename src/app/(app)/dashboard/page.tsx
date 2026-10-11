import Link from "next/link";
import {
  BookOpen,
  Library,
  ArrowUpRight,
  Users,
  Clock3,
  ClipboardList,
  Wallet,
  Plus,
  ArrowLeftRight,
  CalendarDays,
} from "lucide-react";
import { pageUser } from "@/lib/auth";
import { overview } from "@/lib/queries";
import { money } from "@/lib/rules";
import { PageHeading, Panel, Badge, Empty } from "@/components/ui";
import { ActivityChart, AvailabilityChart } from "@/components/charts";
import { LoanTable } from "@/components/loan-table";
export default async function Dashboard() {
  const user = await pageUser();
  const data = await overview(user);
  const student = user.role === "STUDENT";
  const stats = [
    {
      label: "Book titles",
      value: data.stats.titles,
      icon: BookOpen,
      note: "In the campus collection",
    },
    {
      label: "Physical copies",
      value: data.stats.copies,
      icon: Library,
      note: "Across all active titles",
    },
    {
      label: "Available to borrow",
      value: data.stats.available,
      icon: ArrowUpRight,
      note: "Ready for their next reader",
    },
    {
      label: student ? "My active loans" : "Currently issued",
      value: data.stats.issued,
      icon: ArrowLeftRight,
      note: student
        ? "Keep an eye on your due dates"
        : "Knowledge in circulation",
    },
  ];
  const physicalIssued = data.books
    .flatMap((b) => b.copies)
    .filter((c) => c.status === "ISSUED").length;
  return (
    <>
      <PageHeading
        title={`Good to see you, ${user.name.split(" ")[0]}.`}
        description="Here’s what’s happening in your library today."
        action={
          <>
            <span className="button secondary">
              <CalendarDays size={14} />
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Kolkata",
              })}
            </span>
            <Link href={student ? "/books" : "/loans"} className="button">
              <Plus size={15} />
              {student ? "Find a book" : "Issue a book"}
            </Link>
          </>
        }
      />
      <div className="welcome-banner">
        <div>
          <p className="eyebrow">A LITTLE ORDER. A WORLD OF KNOWLEDGE.</p>
          <h2>Every book has a next chapter.</h2>
          <p>
            {student
              ? "Discover something new, keep track of your reads, and make room for your next idea."
              : "Keep your collection moving and your readers inspired."}
            <br />
            {student
              ? "Your campus library is yours to explore."
              : "Your entire library, beautifully in sync."}
          </p>
        </div>
        <div className="banner-art" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="stats-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-top">
              <span>{s.label}</span>
              <span className="stat-icon">
                <s.icon size={15} />
              </span>
            </div>
            <strong>{s.value.toLocaleString("en-IN")}</strong>
            <small>{s.note}</small>
          </div>
        ))}
      </div>
      <div className="secondary-stats">
        {[
          {
            icon: ClipboardList,
            label: "Pending requests",
            value: data.stats.pending,
            href: "/requests",
          },
          {
            icon: Clock3,
            label: "Overdue books",
            value: data.stats.overdue,
            href: "/overdue",
          },
          {
            icon: Wallet,
            label: "Outstanding fines",
            value: money(data.stats.outstanding),
            href: "/fines",
          },
          {
            icon: Users,
            label: student ? "My total borrows" : "Active students",
            value: student ? data.loans.length : data.stats.students,
            href: student ? "/loans" : "/students",
          },
        ].map((s) => (
          <div key={s.label}>
            <s.icon size={19} />
            <Link href={s.href}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </Link>
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <Panel
          title="Library activity"
          subtitle="Issues and returns over the last 7 days"
        >
          <div className="chart-legend">
            <span>
              <i style={{ background: "#b96f50" }} />
              Books issued
            </span>
            <span>
              <i style={{ background: "#7f9173" }} />
              Books returned
            </span>
          </div>
          <ActivityChart data={data.trend} />
        </Panel>
        <Panel
          title="A collection in balance"
          subtitle="Live physical copy availability"
        >
          <AvailabilityChart
            available={data.stats.available}
            issued={physicalIssued}
            other={data.stats.copies - data.stats.available - physicalIssued}
          />
        </Panel>
      </div>
      <div className="dashboard-columns">
        <Panel
          title="Recently issued books"
          subtitle="The latest stories finding their readers"
          href="/loans"
        >
          <LoanTable loans={data.loans.slice(0, 5)} compact />
        </Panel>
        <Panel
          title="Pending requests"
          subtitle="A new read is just an approval away"
          href="/requests"
        >
          <div className="request-list">
            {data.requests
              .filter((r) => r.status === "PENDING")
              .slice(0, 4)
              .map((r) => (
                <Link href="/requests" key={r.id} className="request-item">
                  <span className="avatar">{r.student.user.name[0]}</span>
                  <div>
                    <strong>{r.student.user.name}</strong>
                    <p>{r.book.title}</p>
                  </div>
                  <Badge tone="warning">Pending</Badge>
                </Link>
              ))}
            {!data.stats.pending && (
              <Empty
                title="All caught up"
                text="No requests are waiting for review."
              />
            )}
          </div>
        </Panel>
      </div>
      <div className="quick-actions">
        <span>MAKE LIGHT WORK OF YOUR DAY</span>
        {(student
          ? [
              ["/books", "Browse collection"],
              ["/requests", "My requests"],
              ["/loans", "My borrowing"],
            ]
          : [
              ["/books", "Add a book"],
              ["/students", "Register student"],
              ["/loans", "Issue a book"],
              ["/loans?status=active", "Process return"],
            ]
        ).map(([href, label]) => (
          <Link className="button secondary" key={label} href={href}>
            <Plus size={13} />
            {label}
          </Link>
        ))}
      </div>
      <div className="dashboard-columns">
        <Panel
          title="Overdue attention"
          subtitle="Help these books find their way back"
          href="/overdue"
        >
          {data.overdue.length ? (
            <div className="request-list">
              {data.overdue.slice(0, 3).map((l) => (
                <div className="request-item" key={l.id}>
                  <Clock3 size={18} className="danger-text" />
                  <div>
                    <strong>{l.copy.book.title}</strong>
                    <p>
                      {l.student.user.name} · {l.copy.accession}
                    </p>
                  </div>
                  <Badge tone="danger">Overdue</Badge>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Right on time"
              text="No overdue books in this view."
            />
          )}
        </Panel>
        <Panel
          title="Readers’ favourites"
          subtitle="Most borrowed titles in your records"
          href={student ? "/loans" : "/reports"}
        >
          <div className="request-list">
            {Object.entries(
              data.loans.reduce<Record<string, number>>((a, l) => {
                a[l.copy.book.title] = (a[l.copy.book.title] || 0) + 1;
                return a;
              }, {}),
            )
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([title, count], i) => (
                <div className="request-item" key={title}>
                  <span className="avatar">0{i + 1}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>
                      {count} {count === 1 ? "borrow" : "borrows"}
                    </p>
                  </div>
                </div>
              ))}
            {!data.loans.length && <Empty />}
          </div>
        </Panel>
      </div>
    </>
  );
}
