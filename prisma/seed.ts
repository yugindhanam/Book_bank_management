import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { DAY, fineAmount } from "../src/lib/rules";
const db = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Development seed is disabled in production.");
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error(
      "Set DEMO_PASSWORD to a local-only password of at least 12 characters.",
    );
  if (await db.user.count()) {
    console.log(
      "Database already contains users. Seed skipped to preserve existing data.",
    );
    return;
  }
  const passwordHash = await hash(password, 12);
  await db.$transaction(
    async (tx) => {
      const admin = await tx.user.create({
        data: {
          name: "Aarav Mehta",
          email: "admin@folio.local",
          passwordHash,
          role: "ADMIN",
        },
      });
      const librarian = await tx.user.create({
        data: {
          name: "Priya Sharma",
          email: "librarian@folio.local",
          passwordHash,
          role: "LIBRARIAN",
        },
      });
      await tx.librarySettings.create({ data: { id: "library" } });
      const categories = await Promise.all(
        [
          "Computer Science",
          "Literature",
          "Mathematics",
          "Science",
          "Business",
          "Design",
        ].map((name) =>
          tx.category.create({
            data: {
              name,
              description: `Explore the ${name.toLowerCase()} collection.`,
            },
          }),
        ),
      );
      const titles: [string, string, number, number][] = [
        ["The Design of Everyday Things", "Don Norman", 5, 2013],
        ["Clean Code", "Robert C. Martin", 0, 2008],
        ["Introduction to Algorithms", "Thomas H. Cormen", 0, 2022],
        ["The Psychology of Money", "Morgan Housel", 4, 2020],
        ["Atomic Habits", "James Clear", 4, 2018],
        ["A Brief History of Time", "Stephen Hawking", 3, 1988],
        ["The Great Gatsby", "F. Scott Fitzgerald", 1, 1925],
        ["Discrete Mathematics", "Kenneth H. Rosen", 2, 2019],
        ["Designing Data-Intensive Applications", "Martin Kleppmann", 0, 2017],
        ["The Alchemist", "Paulo Coelho", 1, 1988],
        ["Thinking, Fast and Slow", "Daniel Kahneman", 4, 2011],
        ["Linear Algebra and Its Applications", "Gilbert Strang", 2, 2016],
        ["The Pragmatic Programmer", "David Thomas & Andrew Hunt", 0, 2019],
        ["To Kill a Mockingbird", "Harper Lee", 1, 1960],
        ["Concepts of Physics", "H. C. Verma", 3, 1992],
        ["Refactoring", "Martin Fowler", 0, 2018],
        ["The Elements of Typographic Style", "Robert Bringhurst", 5, 2012],
        ["Pride and Prejudice", "Jane Austen", 1, 1813],
        ["Calculus", "James Stewart", 2, 2015],
        ["The Lean Startup", "Eric Ries", 4, 2011],
        ["Computer Networks", "Andrew S. Tanenbaum", 0, 2021],
        ["The Selfish Gene", "Richard Dawkins", 3, 1976],
        [
          "The Visual Display of Quantitative Information",
          "Edward Tufte",
          5,
          2001,
        ],
        ["Database System Concepts", "Abraham Silberschatz", 0, 2019],
      ];
      const books = [];
      for (const [i, [title, author, category, year]] of titles.entries()) {
        books.push(
          await tx.book.create({
            data: {
              title,
              author,
              year,
              categoryId: categories[category].id,
              publisher: "Campus reference collection",
              edition: "Library edition",
              shelf: `${String.fromCharCode(65 + category)}-${String(i + 1).padStart(2, "0")}`,
              description: `Explore ${title}, a valued addition to our ${categories[category].name.toLowerCase()} collection. Available to college students for learning, reference and discovery.`,
              copies: {
                create: Array.from({ length: (i % 3) + 2 }, (_, j) => ({
                  accession: `FOL-${String(i + 1).padStart(3, "0")}-${j + 1}`,
                })),
              },
            },
            include: { copies: true },
          }),
        );
      }
      const names = [
        "Ananya Rao",
        "Rohan Patel",
        "Ishita Nair",
        "Arjun Singh",
        "Meera Iyer",
        "Kabir Shah",
        "Diya Menon",
        "Aditya Verma",
      ];
      const students = [];
      for (const [i, name] of names.entries())
        students.push(
          await tx.student.create({
            data: {
              rollNumber: `ST2026${String(i + 1).padStart(3, "0")}`,
              department: [
                "Computer Science",
                "Electronics",
                "Mechanical",
                "Business",
              ][i % 4],
              semester: (i % 6) + 1,
              phone: `90000000${String(i + 1).padStart(2, "0")}`,
              user: {
                create: {
                  name,
                  email:
                    i === 0
                      ? "student@folio.local"
                      : `${name.toLowerCase().replace(" ", ".")}@folio.local`,
                  passwordHash,
                  role: "STUDENT",
                },
              },
            },
          }),
        );
      const now = new Date();
      const ago = (n: number) => new Date(now.getTime() - n * DAY);
      for (let i = 0; i < 18; i++) {
        const copy = books[i].copies[0];
        const student = students[i % students.length];
        const historical = i >= 10;
        const issuedAt = ago(
          historical ? 24 + (i % 5) : i < 4 ? 18 + i : i % 7,
        );
        const dueAt = new Date(issuedAt.getTime() + 14 * DAY);
        const returnedAt = historical ? ago(i % 7) : null;
        const loan = await tx.loan.create({
          data: {
            copyId: copy.id,
            studentId: student.id,
            issuedById: librarian.id,
            issuedAt,
            dueAt,
            returnedAt,
            returnedById: historical ? librarian.id : null,
            dailyFine: 500,
            graceDays: 0,
          },
        });
        if (!historical)
          await tx.bookCopy.update({
            where: { id: copy.id },
            data: { status: "ISSUED" },
          });
        if (returnedAt) {
          const assessed = fineAmount(dueAt, returnedAt, 500, 0);
          if (assessed) {
            const fine = await tx.fine.create({
              data: { loanId: loan.id, assessed },
            });
            if (i % 2 === 0)
              await tx.settlement.create({
                data: {
                  fineId: fine.id,
                  amount: assessed,
                  recordedById: librarian.id,
                  reference: `DEMO-${i}`,
                  createdAt: returnedAt,
                },
              });
          }
        }
        await tx.auditLog.create({
          data: {
            userId: librarian.id,
            action: historical ? "BOOK_RETURNED" : "BOOK_ISSUED",
            recordId: loan.id,
            detail: copy.accession,
            createdAt: returnedAt ?? issuedAt,
          },
        });
      }
      for (let i = 0; i < 6; i++)
        await tx.bookRequest.create({
          data: {
            bookId: books[18 + i].id,
            studentId: students[i].id,
            status: i === 4 ? "APPROVED" : i === 5 ? "REJECTED" : "PENDING",
            reason: i === 5 ? "Requested edition is under review." : null,
            createdAt: ago(i % 3),
          },
        });
      const completed = await tx.bookRequest.create({
        data: {
          bookId: books[10].id,
          studentId: students[2].id,
          status: "FULFILLED",
          createdAt: ago(26),
        },
      });
      const completedLoan = await tx.loan.findFirstOrThrow({
        where: { copyId: books[10].copies[0].id },
      });
      await tx.loan.update({
        where: { id: completedLoan.id },
        data: { requestId: completed.id },
      });
      for (const u of [
        admin,
        librarian,
        ...students.map((s) => ({ id: s.userId })),
      ])
        await tx.notification.create({
          data: {
            userId: u.id,
            message:
              "Welcome to Folio. Your campus collection is ready to explore.",
          },
        });
      await tx.auditLog.create({
        data: {
          userId: admin.id,
          action: "DEVELOPMENT_SEED",
          recordId: "library",
          detail:
            "24 titles, 8 students and consistent demonstration circulation records.",
        },
      });
    },
    { timeout: 60000 },
  );
  console.log(
    "Seed complete: 24 books, 8 students, staff, requests, loans and settlements. Demo password is the value of DEMO_PASSWORD in your local .env.",
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
