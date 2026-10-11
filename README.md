# Folio — LICET Book Bank Management System

A working book bank application for **LICET — Loyola-ICAM College of Engineering and Technology**, with an espresso sidebar, warm editorial interface, responsive navigation, real PostgreSQL storage and three access levels.

## Run this prepared workspace

Dependencies, a private local `.env`, migrations and development records have been prepared. PostgreSQL runs in **this project's `.postgres/data`**, bound to `127.0.0.1:55432`. It does not modify an existing PostgreSQL installation's data directory.

```powershell
cd "C:\Users\Home\Desktop\SE project"
powershell -ExecutionPolicy Bypass -File .\scripts\start-db.ps1
npm run dev
```

Open **http://127.0.0.1:3000**. Use that hostname consistently: origin checks compare against `APP_ORIGIN`.

Staff demonstration accounts originally created in this database (use any password changes you have since made):

| Role | Email | Password |
| --- | --- | --- |
| Administrator | admin@folio.local | Your local `DEMO_PASSWORD` |
| Librarian | librarian@folio.local | Your local `DEMO_PASSWORD` |

The prepared database now contains the supplied **67 LICET Information Technology students, semester 5** instead of the eight mock students. Their login emails follow `name.28it@licet.ac.in`, excluding initials. Unique generated passwords are in the private `.local-data/licet-student-logins-*.txt` file. The old `student@folio.local` account and its sample circulation records were removed. Catalogue and staff accounts were retained; a database backup from before replacement is in `.local-data/`.

These are intentional local demonstration credentials. A fresh seed uses **your own `DEMO_PASSWORD`**, and refuses to run with `NODE_ENV=production`. Never seed these accounts into a public production database.

Stop the web server with Ctrl+C. Stop the project database when finished:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-db.ps1
```

## Fresh installation on Windows

Prerequisites: Node.js 22.12+ (Node 24 recommended), npm and PostgreSQL 16+. This workspace was tested against PostgreSQL 18. Docker is optional; no hosted service is required.

1. Install dependencies: `npm ci`.
2. In pgAdmin or `psql`, create a dedicated database and login. Example SQL (replace the password):

   ```sql
   CREATE ROLE bookbank WITH LOGIN PASSWORD 'your-long-random-password';
   CREATE DATABASE bookbank OWNER bookbank;
   ```

3. Copy and edit the environment file:

   ```powershell
   Copy-Item .env.example .env
   code .env
   ```

   Set `DATABASE_URL` to your PostgreSQL connection string, with URL-encoded credentials. Set `APP_ORIGIN="http://127.0.0.1:3000"`. Choose a `DEMO_PASSWORD` of at least 12 characters for development seeding.

4. Generate the Prisma client, apply checked-in migrations and seed:

   ```powershell
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

5. On a fresh development seed, sign in using the staff emails above or `student@folio.local`, with the password you chose in `DEMO_PASSWORD`.

The development/test seed inserts 24 books, 72 physical copies, six categories, eight fictional students, two staff users, requests and a consistent mix of loans and settlements. It runs transactionally and **skips a database containing users**, preserving the current LICET roster. Do not run the seed to reset a database. Real student roster and password files remain local and are excluded from Git.

## What you can demonstrate

- **Admin:** every module, staff accounts and roles, borrowing settings and searchable audit records.
- **Librarian:** catalogue and category CRUD, accession management, student registration/edit/deactivation, CSV imports, request decisions, issue/return transactions, settlements and reports.
- **Student:** catalogue search, available-book requests and cancellation, own request history, own borrowing history, accrued/final fines, notifications and own profile. Other students' records are inaccessible.
- **Catalogue:** title/author/ISBN/accession/category search, availability filters, sorting, pagination, grid/list view, detail pages, optional HTTPS cover URL with typographic fallback. Archiving preserves history and is blocked while loans or requests remain active.
- **Copies:** unique accession numbers and available/issued/lost/maintenance states. Overdue is derived from the active loan, so it cannot become stale.
- **Requests:** pending → approved/rejected/cancelled; approved → fulfilled through issue. Approval does not reserve or subtract inventory. Multiple readers may request a title; only the successful issue transaction claims a physical copy.
- **Circulation:** registered active borrowers only, configurable limits, snapshotted due dates, exact copy references, confirmation before commit, actual return timestamp and copy condition.
- **Fines:** ongoing accrual, fixed assessment at return, partial recorded settlements, admin-only waivers with reasons, settlement references and staff/date history. This is bookkeeping, **not an online payment gateway**.
- **Reports:** date-filtered issues, returns and settlements; current inventory and outstanding balances; popular titles, active borrowers, category inventory, monthly trends, student search, issue/return CSV export and print layout.
- **Notifications:** persisted request/issue/return/settlement updates and live upcoming/overdue reminders. No email or SMS provider is configured.

Suggested faculty demo: log in as the student, request an available title, switch to librarian, approve it, issue the matching physical copy using the approved request, and show the inventory change. Return an overdue seeded book, record a partial settlement, then show the updated fine and audit trail as admin.

## CSV student import

Download the header template from Students or `public/students-template.csv`. Required columns: `name,email,rollNumber,department,semester,password`; `phone` is optional. Use unique email/roll numbers, semester 1–12 and passwords of 12+ characters. Up to 200 rows / 500 KB per import. Valid rows are committed individually; the UI lists row-specific validation/duplicate errors. Imports always create student accounts and cannot inject roles or existing record IDs.

## Architecture and business rules

Next.js App Router + React/TypeScript, Tailwind CSS tokens, Lucide, Motion, Recharts, React Hook Form, Zod and Sonner. Small semantic controls and native modal dialogs avoid a second component library. Prisma 6 accesses PostgreSQL through server-only imports. The authentication equivalent uses bcrypt password hashes and opaque, cryptographically random session cookies; only token hashes are stored in the database.

| Layer | Location |
| --- | --- |
| Protected layouts and module pages | `src/app/(app)` |
| API validation and origin/session checks | `src/app/api`, `src/lib/http.ts` |
| Transactional domain operations | `src/lib/services.ts` |
| Authentication and session lifecycle | `src/lib/auth.ts` |
| Shared money/date rules and schemas | `src/lib/rules.ts`, `src/lib/schemas.ts` |
| Database-backed queries and reports | `src/lib/queries.ts`, `src/lib/reports.ts` |
| Reusable controls, forms, charts and shell | `src/components` |
| Normalised data model and migrations | `prisma` |
| Unit/component and PostgreSQL integration tests | `tests` |

User → optional Student; Book → Category and many BookCopies; Loan → exact BookCopy, Student and issuing/returning staff; BookRequest → Student/Book and optional fulfilled Loan; Fine → Loan; Settlement → Fine and responsible staff. A fine's student is derived through its loan rather than duplicated. AuditLog and Notification retain responsibility and account ownership.

**Concurrency:** serializable transactions retry serialization failures. Conditional copy/loan updates and PostgreSQL partial unique indexes guarantee at most one active loan per copy and one active request per student/title. Borrowing limits are checked in the same serializable transaction as issuance. Return/fine creation and settlement/balance checks are atomic. Referenced records use restrictive foreign keys and archival instead of destructive deletion.

**Fine rule:** `max(0, UTC calendar days after due date − grace days) × daily rate`. The full due date is free. Loan duration uses exact 24-hour days. Daily fine and grace period are copied to the loan at issue, so a policy edit does not change old obligations. Money is integer **paise** (100 = ₹1), avoiding floating point payment errors. A backdated return must be between issuance and the current time. Lost/maintenance returns stop overdue accrual; replacement charges are outside this project's policy.

**Security:** 12-character minimum for new passwords, bcrypt cost 12, eight-hour database sessions, HttpOnly/SameSite cookies (Secure in production), account deactivation and staff edits revoke sessions, persistent per-email login throttling, exact-origin mutation checks, server role/ownership checks, safe API errors, security headers, audited mutations and CSV formula escaping. Secrets and local PostgreSQL files are ignored by Git. Production must use HTTPS and its exact `APP_ORIGIN`.

**Report semantics:** date filters independently select issue timestamps, return timestamps and settlement timestamps. Current inventory/overdue/outstanding figures are explicitly labelled snapshots. Search applies to circulation, not the entire inventory. Student dashboards scope loans, requests and money to that student; collection availability is shared.

## Verification

```powershell
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
npm start
```

The integration suite creates a timestamped PostgreSQL schema, applies the actual migration, exercises real transactions, then drops only that schema. Its database login needs schema creation permission. It does not modify application records. Tests cover authentication, role checks, CRUD, duplicates, requests, copy availability, borrowing limits, competing issues, direct database constraints, fines/returns/settlements, private student queries and report totals.

Playwright runs headless Google Chrome against a separate seeded PostgreSQL schema and a temporary server on port 3100. Install Chrome before running `npm run test:e2e`. It verifies desktop/mobile navigation, staff modules, CSV validation, book editing, student registration, the full request → approval → issue → overdue return → settlement flow, private-record protection and CSV export. Screenshots are written to `qa/`; the test schema and test server are removed afterwards.

Dependency review: `npm audit --omit=dev` reports no runtime vulnerabilities. The full audit currently reports five high-severity development-only advisories through the Next.js ESLint plugin’s `fast-glob` → `micromatch` → `braces` chain. No compatible patched chain was offered by npm; its proposed fix downgrades the Next.js lint configuration across major versions. These remain documented rather than applying that incompatible downgrade. Vitest and DeepmergeTS were updated to resolve the other audit findings.

Production startup (`npm start`) expects a completed build and an HTTPS reverse proxy for secure session cookies. Use `npm run dev` for a plain-HTTP local demo. Set up database backups, infrastructure rate limiting, monitoring, a first-admin provisioning process and real institutional credentials before public deployment. Full-table analytics suit this lab dataset; large institutions should move aggregate queries and report exports to paginated database-side jobs.

## Troubleshooting

- Database connection error: start PostgreSQL and check the host, port, username and database in `.env`. This prepared cluster uses **55432**, fresh standard installs often use **5432**.
- Forbidden origin: open the exact `APP_ORIGIN`, or update it and restart Next.js. `localhost` and `127.0.0.1` are distinct origins.
- Windows `uv_os_get_passwd`/directory permission errors in restricted terminals: run the command in your regular VS Code PowerShell terminal.
- Port 3000 in use: stop the conflicting process, or use `npm run dev -- --port 3001` and change `APP_ORIGIN` to match.
- Login after repeated failures: wait 15 minutes for the per-email throttle window to expire.
- Prisma migrations should be applied with `npm run db:migrate`; avoid `db push`, which would omit the custom partial indexes.
