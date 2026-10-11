"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion, MotionConfig } from "motion/react";
import {
  BookOpen,
  LayoutDashboard,
  Library,
  Shapes,
  Users,
  ClipboardList,
  ArrowLeftRight,
  Clock3,
  Wallet,
  ChartNoAxesCombined,
  ShieldCheck,
  Settings,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
const navigation = [
  ["dashboard", "Overview", LayoutDashboard, "all"],
  ["books", "Books catalogue", Library, "all"],
  ["categories", "Book categories", Shapes, "staff"],
  ["students", "Students", Users, "staff"],
  ["requests", "Book requests", ClipboardList, "all"],
  ["loans", "Issue & return", ArrowLeftRight, "all"],
  ["overdue", "Overdue books", Clock3, "all"],
  ["fines", "Fines & settlements", Wallet, "all"],
  ["reports", "Reports & analytics", ChartNoAxesCombined, "staff"],
  ["users", "User management", ShieldCheck, "admin"],
  ["audit", "Activity log", ClipboardList, "admin"],
  ["settings", "Settings", Settings, "admin"],
] as const;
export function Shell({
  user,
  unread,
  libraryName,
  children,
}: {
  user: { name: string; role: string };
  unread: number;
  libraryName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const section = pathname.split("/")[1];
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        {open && (
          <button
            className="drawer-backdrop"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
        )}
        <aside className={`sidebar ${open ? "open" : ""}`}>
          <Link href="/dashboard" className="brand">
            <span className="brand-icon">
              <BookOpen size={24} />
            </span>
            <span>
              folio<span className="brand-sub">LICET BOOK BANK</span>
            </span>
          </Link>
          <button
            className="mobile-close icon-button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
          <div className="workspace">
            <span className="workspace-symbol">F</span>
            <div>
              <strong>{libraryName}</strong>
              <small>Knowledge, in circulation.</small>
            </div>
          </div>
          <p className="nav-label">WORKSPACE</p>
          <nav>
            {navigation
              .filter(
                (n) =>
                  n[3] === "all" ||
                  (n[3] === "staff" && user.role !== "STUDENT") ||
                  (n[3] === "admin" && user.role === "ADMIN"),
              )
              .map(([href, label, Icon]) => (
                <Link
                  key={href}
                  href={`/${href}`}
                  className={`nav-item ${section === href ? "active" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={18} />
                  <span>
                    {user.role === "STUDENT" && href === "loans"
                      ? "My borrowing"
                      : label}
                  </span>
                  {section === href && <span className="nav-dot" />}
                </Link>
              ))}
          </nav>
          <div className="sidebar-note">
            <BookOpen size={20} />
            <p>
              A good book opens
              <br />a world of possibilities.
            </p>
            <span>MAKE ROOM FOR DISCOVERY</span>
          </div>
          <div className="sidebar-profile">
            <Link href="/profile" className="profile-link">
              <span className="avatar">{user.name.slice(0, 1)}</span>
              <span>
                <strong>{user.name}</strong>
                <small>{user.role.toLowerCase()}</small>
              </span>
            </Link>
            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={async () => {
                const r = await fetch("/api/auth", { method: "DELETE" });
                if (r.ok) {
                  router.push("/login");
                  router.refresh();
                } else toast.error("Could not sign out.");
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                onClick={() => setOpen(true)}
              >
                <Menu />
              </button>
              <span>Workspace</span>
              <span>/</span>
              <strong>
                {navigation.find((n) => n[0] === section)?.[1] || "My account"}
              </strong>
            </div>
            <div className="header-tools">
              <form action="/books" className="global-search">
                <Search size={16} />
                <input
                  name="q"
                  placeholder="Search the collection…"
                  aria-label="Search the collection"
                />
                <kbd>⌕</kbd>
              </form>
              <Link
                className="notification-button icon-button"
                href="/notifications"
                aria-label={`Notifications, ${unread} unread`}
              >
                <Bell size={19} />
                {unread > 0 && <i />}
              </Link>
              <span className="header-divider" />
              <Link href="/profile" className="avatar header-avatar">
                {user.name.slice(0, 1)}
              </Link>
            </div>
          </header>
          <motion.main
            className="main-content"
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
            <footer className="page-footer">
              <span>LICET Book Bank · A little order. A world of knowledge.</span>
              <Link href="/books">
                Explore the collection <ArrowUpRight size={13} />
              </Link>
            </footer>
          </motion.main>
        </div>
      </div>
    </MotionConfig>
  );
}
