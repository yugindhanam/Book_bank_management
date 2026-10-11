# Verification — 12 October 2026

| Check | Result |
| --- | --- |
| `npm run lint` | Passed, no warnings |
| `npm run typecheck` | Passed |
| `npm test` | 12 tests passed |
| `npm run test:integration` | 16 real-PostgreSQL scenarios passed |
| `npm run test:e2e` | Three Chrome browser scenarios passed |
| `npm run build` | Successful Next.js production build |
| Local `/login` | HTTP 200 at `http://127.0.0.1:3000/login` |
| `npm audit --omit=dev` | No reported vulnerabilities |

The PostgreSQL integration and browser suites use disposable, independent schemas. Each applies the checked-in migrations. No browser test edits the prepared demonstration database.

Browser coverage includes all staff modules rendering, borrowing-policy editing, valid/invalid CSV rows, prevention of imported admin roles, valid/invalid login, mobile navigation, no horizontal mobile overflow, book creation/editing, student registration, student requests, cross-student denial, staff approval, exact-copy issuance, overdue return, settlement, CSV report export and rejection of a foreign request origin.

Database coverage includes password validation and throttling, roles, book/student CRUD, unique accessions, request transitions, unavailable copies, limits, concurrent issuance, direct unique-index enforcement, due dates, grace-adjusted fine assessment, inventory restoration, duplicate-return rejection, partial settlements, overpayment/waiver restrictions, scoped student queries and report totals.

Visual checks: `desktop-dashboard.png` at a 1440-pixel viewport and `mobile-catalogue.png` at a 390-pixel viewport were inspected. They use the same application and real database queries as the demo.

## Remaining limitations

- Five high-severity **development-only** audit findings remain in the Next.js ESLint plugin / fast-glob / micromatch / braces dependency chain. npm offers an incompatible major-version downgrade rather than a compatible patch. No affected package is in the production dependency audit.
- Settlements are recorded bookkeeping entries. No payment gateway, email or SMS service is integrated; notifications are in-app.
- Production hosting was not requested or performed. Use HTTPS, a production database, real accounts, backups, monitoring and infrastructure rate limits before public deployment. The included credentials and seed are local demonstration data only.
- Some reporting and circulation filters aggregate records in server memory, appropriate to a lab demonstration. For large institutional datasets, move aggregation and export to database-side queries or background jobs.

All core requested local demonstration workflows are implemented. External production operations are not claimed as completed.
