import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const password = process.env.DEMO_PASSWORD!;
async function login(page: Page, email: string, pass = password) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
}
test.afterAll(async () => db.$disconnect());
test("admin modules, settings and validated CSV import", async ({ page }) => {
  await login(page, "admin@folio.local");
  for (const path of ["/categories", "/users", "/settings", "/audit", "/notifications", "/overdue", "/reports"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("We couldn’t load this page.")).toHaveCount(0);
  }
  await page.goto("/settings");
  await page.getByRole("button", { name: "Update library settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Update library settings" });
  await dialog.getByLabel("Library name", { exact: true }).fill("LICET Book Bank");
  await dialog.getByRole("button", { name: "Confirm & save" }).click();
  await expect(dialog).not.toBeVisible();
  const imported = await page.request.post("/api/students/import", {
    headers: { origin: "http://127.0.0.1:3100", "Content-Type": "text/csv" },
    data: `name,email,rollNumber,department,semester,password,role\nCSV Reader,csv.reader@folio.local,CSV-001,CS,1,${password},ADMIN\nInvalid,not-an-email,CSV-002,CS,99,short,ADMIN`,
  });
  expect(imported.status()).toBe(200);
  const result = await imported.json();
  expect(result.imported).toBe(1);
  expect(result.errors).toHaveLength(1);
  const created = await db.user.findUniqueOrThrow({ where: { email: "csv.reader@folio.local" } });
  expect(created.role).toBe("STUDENT");
});
test("login, dashboard and responsive navigation", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("admin@folio.local");
  await page.getByLabel("Password", { exact: true }).fill("incorrect");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Email or password is incorrect.", { exact: true }),
  ).toBeVisible();
  await login(page, "admin@folio.local");
  await expect(
    page.getByRole("heading", { name: /Good to see you/ }),
  ).toBeVisible();
  await expect(page.getByText("72", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: "qa/desktop-dashboard.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "Books catalogue", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A shelf for every curiosity." }),
  ).toBeVisible();
  await page.screenshot({ path: "qa/mobile-catalogue.png", fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
test("staff create/edit, student request, issue, return, fine and reports", async ({
  page,
}) => {
  await login(page, "admin@folio.local");
  await page.goto("/books");
  await page.getByRole("button", { name: "Add a book", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Add a book" });
  await dialog.getByLabel("Book title").fill("QA Circulation Handbook");
  await dialog.getByLabel("Author", { exact: false }).fill("Folio Test Team");
  await dialog
    .getByLabel("Category")
    .selectOption({ label: "Computer Science" });
  await dialog.getByLabel("Shelf location").fill("QA-01");
  await dialog.getByRole("button", { name: "Confirm & save" }).click();
  await expect(dialog).not.toBeVisible();
  const book = await db.book.findFirstOrThrow({
    where: { title: "QA Circulation Handbook" },
    include: { copies: true },
  });
  await page.goto(`/books/${book.id}`);
  await page.getByRole("button", { name: "Edit book", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Edit book" });
  await dialog.getByLabel("Publisher").fill("QA Press");
  await dialog.getByRole("button", { name: "Confirm & save" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("QA Press", { exact: true })).toBeVisible();
  await page.goto("/students");
  await page
    .getByRole("button", { name: "Register student", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Register student" });
  await dialog.getByLabel("Full name").fill("QA Reader");
  await dialog.getByLabel("Email address").fill("qa.reader@folio.local");
  await dialog.getByLabel("Roll number").fill("QA-001");
  await dialog.getByLabel("Department").fill("Computer Science");
  await dialog.getByLabel("Password", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Confirm & save" }).click();
  await expect(dialog).not.toBeVisible();
  await logout(page);
  await login(page, "qa.reader@folio.local");
  await page.goto(`/books/${book.id}`);
  await page.getByRole("button", { name: "Request this book" }).click();
  await expect(page.getByText("Saved successfully").first()).toBeVisible();
  await page.goto("/requests");
  await expect(
    page.getByRole("table").getByText("PENDING", { exact: true }),
  ).toBeVisible();
  const forbidden = await page.request.post("/api/actions/settings", {
    data: {},
    headers: { origin: "http://127.0.0.1:3100" },
  });
  expect(forbidden.status()).toBe(403);
  const other = await db.student.findFirstOrThrow({
    where: { rollNumber: { not: "QA-001" } },
  });
  await page.goto(`/students/${other.id}`);
  await expect(page.getByText(/could not be found/i)).toBeVisible();
  await page.goto("/dashboard");
  await logout(page);
  await login(page, "librarian@folio.local");
  await page.goto("/requests?q=QA+Circulation");
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(
    page.getByRole("table").getByText("APPROVED", { exact: true }),
  ).toBeVisible();
  await page.goto("/loans");
  await page.getByRole("button", { name: "Issue a book", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Issue a book" });
  await dialog
    .getByLabel("Student", { exact: true })
    .selectOption({ label: "QA Reader · QA-001" });
  await dialog.getByLabel("Available physical copy", { exact: true }).selectOption({
    label: `QA Circulation Handbook · ${book.copies[0].accession}`,
  });
  await dialog
    .getByLabel("Fulfil approved request (optional)")
    .selectOption({ label: "QA Reader · QA Circulation Handbook" });
  await dialog.getByRole("button", { name: "Confirm & save" }).click();
  await expect(dialog).not.toBeVisible();
  const loan = await db.loan.findFirstOrThrow({
    where: { copyId: book.copies[0].id, returnedAt: null },
  });
  await db.loan.update({
    where: { id: loan.id },
    data: {
      issuedAt: new Date(Date.now() - 20 * 86400000),
      dueAt: new Date(Date.now() - 3 * 86400000),
    },
  });
  await page.goto("/loans?q=QA+Circulation");
  await page.getByRole("button", { name: "Return", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Process return" });
  await dialog.getByRole("button", { name: "Confirm & save" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("table").getByText("Returned", { exact: true }),
  ).toBeVisible();
  await page.goto("/fines?q=QA+Circulation");
  await page
    .getByRole("button", { name: "Record settlement", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Record settlement" });
  await dialog.getByLabel("Reference number").fill("QA-RECEIPT-001");
  await dialog.getByRole("button", { name: "Confirm & save" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Paid", { exact: true })).toBeVisible();
  await page.goto("/reports?q=QA+Reader");
  await expect(page.getByText("QA Circulation Handbook").first()).toBeVisible();
  const exported = await page.request.get("/api/reports?q=QA+Reader");
  expect(exported.status()).toBe(200);
  expect(await exported.text()).toContain("QA-001");
  const badOrigin = await page.request.post("/api/actions/book", {
    data: {},
    headers: { origin: "https://foreign.example" },
  });
  expect(badOrigin.status()).toBe(403);
});
