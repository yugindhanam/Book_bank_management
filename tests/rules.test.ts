import { describe, it, expect } from "vitest";
import {
  dueDate,
  overdueDays,
  fineAmount,
  canManage,
  csv,
} from "../src/lib/rules";
import { bookSchema, loginSchema, studentSchema } from "../src/lib/schemas";
describe("borrowing terms", () => {
  it("calculates due dates across year boundaries", () =>
    expect(dueDate(new Date("2026-12-25T12:00:00Z"), 14).toISOString()).toBe(
      "2027-01-08T12:00:00.000Z",
    ));
  it("does not charge on the due date even after the issue time", () =>
    expect(
      fineAmount(
        new Date("2026-10-01T08:00Z"),
        new Date("2026-10-01T23:59Z"),
        500,
        0,
      ),
    ).toBe(0));
  it("excludes grace days and uses integer paise", () =>
    expect(
      fineAmount(new Date("2026-10-01"), new Date("2026-10-05"), 125, 2),
    ).toBe(250));
  it("does not charge early returns", () =>
    expect(
      fineAmount(new Date("2026-10-05"), new Date("2026-10-01"), 500, 0),
    ).toBe(0));
  it("handles leap days", () =>
    expect(overdueDays(new Date("2028-02-28"), new Date("2028-03-01"))).toBe(
      2,
    ));
  it("allows only staff management", () => {
    expect(canManage("STUDENT")).toBe(false);
    expect(canManage("LIBRARIAN")).toBe(true);
    expect(canManage("ADMIN")).toBe(true);
  });
});
describe("input validation", () => {
  it("rejects invalid login input", () =>
    expect(
      loginSchema.safeParse({ email: "invalid", password: "" }).success,
    ).toBe(false));
  it("rejects empty book titles and insecure cover URLs", () =>
    expect(
      bookSchema.safeParse({
        title: "",
        author: "Test",
        categoryId: "x",
        shelf: "A1",
        coverUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false));
  it("rejects invalid semesters", () =>
    expect(
      studentSchema.safeParse({
        name: "Name",
        email: "n@example.com",
        rollNumber: "X",
        department: "CS",
        semester: 13,
        password: "example-password",
      }).success,
    ).toBe(false));
  it("escapes CSV quotes, newlines and formula injection", () =>
    expect(csv([["=1+1", 'a"b', "a\nb"]])).toBe('"\'=1+1","a""b","a\nb"'));
});
