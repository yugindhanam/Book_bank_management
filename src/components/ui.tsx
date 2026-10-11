import Link from "next/link";
import { ArrowRight, BookOpen, SearchX } from "lucide-react";
import type { ReactNode } from "react";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title = "Nothing here just yet",
  text = "New records will appear here as your library grows.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <SearchX size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">
          {eyebrow ?? "YOUR LIBRARY, THOUGHTFULLY ORGANISED"}
        </p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      <div className="heading-actions">{action}</div>
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  href,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted text-xs mt-1">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="text-link">
            View all <ArrowRight size={14} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
export function BookCover({
  title,
  author,
  category,
  small = false,
  coverUrl,
}: {
  title: string;
  author: string;
  category?: string;
  small?: boolean;
  coverUrl?: string | null;
}) {
  const palette = ["olive", "clay", "navy", "sand", "plum"];
  const color =
    palette[
      Array.from(title).reduce((s, c) => s + c.charCodeAt(0), 0) %
        palette.length
    ];
  return (
    <div
      className={`book-cover ${color} ${small ? "small" : ""}`}
      style={
        coverUrl
          ? {
              backgroundImage: `linear-gradient(0deg,rgba(0,0,0,.7),rgba(0,0,0,.1)),url(${JSON.stringify(coverUrl)})`,
              backgroundSize: "cover",
            }
          : undefined
      }
    >
      <div className="book-spine" />
      <span className="cover-category">
        {category || "THE COLLEGE COLLECTION"}
      </span>
      <BookOpen className="cover-mark" size={small ? 16 : 28} />
      <h3>{title}</h3>
      <span className="cover-author">{author}</span>
      <span className="cover-rule" />
    </div>
  );
}
export function Pagination({
  page,
  total,
  size = 12,
  query,
}: {
  page: number;
  total: number;
  size?: number;
  query: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const href = (p: number) =>
    "?" + new URLSearchParams({ ...query, page: String(p) });
  return (
    <div className="pagination">
      <span>
        {total} records · Page {page} of {pages}
      </span>
      <div>
        {page > 1 && (
          <Link className="button secondary" href={href(page - 1)}>
            Previous
          </Link>
        )}
        {page < pages && (
          <Link className="button secondary" href={href(page + 1)}>
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
