export const DAY = 86_400_000;
export function dueDate(issued: Date, loanDays: number) {
  return new Date(issued.getTime() + loanDays * DAY);
}
// UTC calendar days: the entire due date is free. Grace days are excluded.
export function overdueDays(due: Date, at = new Date()) {
  const day = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.max(0, Math.floor((day(at) - day(due)) / DAY));
}
export function fineAmount(due: Date, at: Date, rate: number, grace: number) {
  return Math.max(0, overdueDays(due, at) - grace) * rate;
}
export function money(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}
export function date(value: Date | string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "—";
}
export function canManage(role: string) {
  return role === "ADMIN" || role === "LIBRARIAN";
}
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function assert(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new AppError(message, status);
}
export function csv(rows: (string | number)[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const s = String(value);
          return (
            '"' +
            (/^[=+@\-\t\r]/.test(s) ? "'" : "") +
            s.replaceAll('"', '""') +
            '"'
          );
        })
        .join(","),
    )
    .join("\r\n");
}
