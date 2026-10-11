import { Prisma, type Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "./db";
import { assert, canManage, dueDate, fineAmount } from "./rules";
import {
  bookSchema,
  categorySchema,
  settingsSchema,
  staffSchema,
  studentSchema,
} from "./schemas";
export type Actor = { id: string; role: Role; student?: { id: string } | null };
type Tx = Prisma.TransactionClient;
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: "Serializable",
        timeout: 15000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        i < 3
      )
        continue;
      throw error;
    }
  }
}
function staff(actor: Actor) {
  assert(canManage(actor.role), "Staff access required.", 403);
}
function admin(actor: Actor) {
  assert(actor.role === "ADMIN", "Administrator access required.", 403);
}
async function audit(
  tx: Tx,
  actor: Actor,
  action: string,
  recordId: string,
  detail = "",
) {
  await tx.auditLog.create({
    data: { userId: actor.id, action, recordId, detail },
  });
  if (["USER_SAVED", "SETTINGS_UPDATED", "BOOK_ARCHIVED", "STUDENT_REGISTERED"].includes(action)) {
    await tx.notification.create({ data: { userId: actor.id, message: `${action.replaceAll("_", " ").toLowerCase()}: ${detail || recordId}. Recorded in the activity log.` } });
  }
}
async function notify(tx: Tx, userId: string, message: string) {
  await tx.notification.create({ data: { userId, message } });
}
export async function saveBook(actor: Actor, input: unknown) {
  staff(actor);
  const { id, copies, ...data } = bookSchema.parse(input);
  return transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id: data.categoryId },
    });
    assert(category && !category.archived, "Choose an active category.");
    const book = id
      ? await tx.book.update({ where: { id }, data })
      : await tx.book.create({ data });
    if (!id)
      await tx.bookCopy.createMany({
        data: Array.from({ length: copies }, (_, i) => ({
          bookId: book.id,
          accession: `BB-${book.id.slice(-8).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
        })),
      });
    await audit(
      tx,
      actor,
      id ? "BOOK_UPDATED" : "BOOK_CREATED",
      book.id,
      book.title,
    );
    return book;
  });
}
export async function saveStudent(actor: Actor, input: unknown) {
  staff(actor);
  const { id, name, email, password, active, ...profile } =
    studentSchema.parse(input);
  assert(
    id || password,
    "A password of at least 12 characters is required for a new account.",
  );
  const passwordHash = password ? await hash(password, 12) : undefined;
  return transaction(async (tx) => {
    const student = id
      ? await tx.student.update({
          where: { id },
          data: {
            ...profile,
            user: {
              update: {
                name,
                email,
                active,
                ...(passwordHash ? { passwordHash } : {}),
              },
            },
          },
        })
      : await tx.student.create({
          data: {
            ...profile,
            user: {
              create: {
                name,
                email,
                active,
                passwordHash: passwordHash!,
                role: "STUDENT",
              },
            },
          },
        });
    if (!active || (passwordHash && id))
      await tx.session.deleteMany({ where: { userId: student.userId } });
    await audit(
      tx,
      actor,
      id ? "STUDENT_UPDATED" : "STUDENT_REGISTERED",
      student.id,
      profile.rollNumber,
    );
    return student;
  });
}
export async function submitRequest(actor: Actor, bookId: string) {
  assert(
    actor.role === "STUDENT" && actor.student,
    "Student access required.",
    403,
  );
  return transaction(async (tx) => {
    const available = await tx.bookCopy.count({
      where: { bookId, status: "AVAILABLE", book: { archived: false } },
    });
    assert(available > 0, "This title has no available copies.");
    assert(
      !(await tx.bookRequest.findFirst({
        where: {
          studentId: actor.student!.id,
          bookId,
          status: { in: ["PENDING", "APPROVED"] },
        },
      })),
      "You already have an active request for this title.",
    );
    const request = await tx.bookRequest.create({
      data: { bookId, studentId: actor.student!.id },
    });
    await audit(tx, actor, "REQUEST_SUBMITTED", request.id);
    return request;
  });
}
export async function reviewRequest(actor: Actor, input: unknown) {
  const { id, status, reason } = z
    .object({
      id: z.string(),
      status: z.enum(["APPROVED", "REJECTED", "CANCELLED"]),
      reason: z.string().max(500).optional(),
    })
    .parse(input);
  return transaction(async (tx) => {
    const request = await tx.bookRequest.findUnique({
      where: { id },
      include: { student: true, book: true },
    });
    assert(request, "Request not found.", 404);
    if (status === "CANCELLED")
      assert(
        canManage(actor.role) || request.studentId === actor.student?.id,
        "Access denied.",
        403,
      );
    else staff(actor);
    assert(
      status === "CANCELLED"
        ? ["PENDING", "APPROVED"].includes(request.status)
        : request.status === "PENDING",
      "This request has already been processed.",
    );
    if (status === "APPROVED") {
      assert(!request.book.archived, "This title is archived.");
      assert(
        (await tx.bookCopy.count({
          where: { bookId: request.bookId, status: "AVAILABLE" },
        })) > 0,
        "No copy is available.",
      );
    }
    await tx.bookRequest.update({ where: { id }, data: { status, reason } });
    await notify(
      tx,
      request.student.userId,
      `Your request for “${request.book.title}” was ${status.toLowerCase()}.${reason ? ` ${reason}` : ""}`,
    );
    await audit(tx, actor, `REQUEST_${status}`, id, reason);
    return request;
  });
}
export async function issueBook(actor: Actor, input: unknown) {
  staff(actor);
  const { studentId, copyId, requestId } = z
    .object({
      studentId: z.string().min(1),
      copyId: z.string().min(1),
      requestId: z.string().optional(),
    })
    .parse(input);
  return transaction(async (tx) => {
    const settings = await tx.librarySettings.upsert({
      where: { id: "library" },
      create: {},
      update: {},
    });
    const student = await tx.student.findUnique({
      where: { id: studentId },
      include: { user: true },
    });
    assert(student?.user.active, "Select an active student.");
    assert(
      (await tx.loan.count({ where: { studentId, returnedAt: null } })) <
        settings.maxLoans,
      `Borrowing limit of ${settings.maxLoans} books reached.`,
    );
    const copy = await tx.bookCopy.findUnique({
      where: { id: copyId },
      include: { book: true },
    });
    assert(
      copy && copy.status === "AVAILABLE" && !copy.book.archived,
      "This copy is not available.",
    );
    if (requestId) {
      const request = await tx.bookRequest.findUnique({
        where: { id: requestId },
      });
      assert(
        request &&
          request.status === "APPROVED" &&
          request.studentId === studentId &&
          request.bookId === copy.bookId,
        "Select the correct approved request.",
      );
    }
    const changed = await tx.bookCopy.updateMany({
      where: { id: copyId, status: "AVAILABLE" },
      data: { status: "ISSUED" },
    });
    assert(changed.count === 1, "Another librarian has issued this copy.");
    const issuedAt = new Date();
    const loan = await tx.loan.create({
      data: {
        studentId,
        copyId,
        requestId: requestId || null,
        issuedById: actor.id,
        issuedAt,
        dueAt: dueDate(issuedAt, settings.loanDays),
        dailyFine: settings.dailyFine,
        graceDays: settings.graceDays,
      },
    });
    if (requestId)
      await tx.bookRequest.update({
        where: { id: requestId },
        data: { status: "FULFILLED" },
      });
    await notify(
      tx,
      student.userId,
      `“${copy.book.title}” has been issued to you. Due ${loan.dueAt.toISOString().slice(0, 10)}.`,
    );
    await audit(tx, actor, "BOOK_ISSUED", loan.id, copy.accession);
    return loan;
  });
}
export async function returnBook(actor: Actor, input: unknown) {
  staff(actor);
  const {
    id,
    returnedAt: rawDate,
    condition,
  } = z
    .object({
      id: z.string(),
      returnedAt: z.string().optional(),
      condition: z
        .enum(["AVAILABLE", "LOST", "MAINTENANCE"])
        .default("AVAILABLE"),
    })
    .parse(input);
  return transaction(async (tx) => {
    const loan = await tx.loan.findUnique({
      where: { id },
      include: { student: true, copy: { include: { book: true } } },
    });
    assert(
      loan && !loan.returnedAt,
      "This loan is already returned or does not exist.",
    );
    const returnedAt = rawDate ? new Date(rawDate) : new Date();
    assert(
      !Number.isNaN(returnedAt.getTime()) &&
        returnedAt >= loan.issuedAt &&
        returnedAt <= new Date(),
      "Return date must be between issue date and now.",
    );
    const changed = await tx.loan.updateMany({
      where: { id, returnedAt: null },
      data: { returnedAt, returnedById: actor.id },
    });
    assert(changed.count === 1, "This loan has already been returned.");
    await tx.bookCopy.update({
      where: { id: loan.copyId },
      data: { status: condition },
    });
    const amount = fineAmount(
      loan.dueAt,
      returnedAt,
      loan.dailyFine,
      loan.graceDays,
    );
    if (amount)
      await tx.fine.create({ data: { loanId: id, assessed: amount } });
    await notify(
      tx,
      loan.student.userId,
      `Return recorded for “${loan.copy.book.title}”.${amount ? ` Overdue fine: ₹${amount / 100}.` : " Thank you for returning on time."}`,
    );
    await audit(
      tx,
      actor,
      "BOOK_RETURNED",
      id,
      `Fine: ${amount} paise; condition: ${condition}`,
    );
    return { amount };
  });
}
export async function settleFine(actor: Actor, input: unknown) {
  staff(actor);
  const { fineId, amount, waived, reason, reference } = z
    .object({
      fineId: z.string(),
      amount: z.coerce.number().int().positive(),
      waived: z.boolean().default(false),
      reason: z.string().max(500).optional(),
      reference: z.string().max(100).optional(),
    })
    .parse(input);
  if (waived) {
    admin(actor);
    assert(reason?.trim(), "A reason is required to waive a fine.");
  }
  return transaction(async (tx) => {
    const fine = await tx.fine.findUnique({
      where: { id: fineId },
      include: { settlements: true, loan: { include: { student: true } } },
    });
    assert(fine, "Fine not found.", 404);
    const balance =
      fine.assessed - fine.settlements.reduce((sum, s) => sum + s.amount, 0);
    assert(amount <= balance, "Amount exceeds the outstanding balance.");
    const settlement = await tx.settlement.create({
      data: {
        fineId,
        amount,
        waived,
        reason,
        reference,
        recordedById: actor.id,
      },
    });
    await audit(
      tx,
      actor,
      waived ? "FINE_WAIVED" : "FINE_SETTLED",
      fineId,
      `${amount} paise`,
    );
    await notify(
      tx,
      fine.loan.student.userId,
      `${waived ? "Waiver" : "Settlement"} of ₹${amount / 100} recorded for your overdue fine.`,
    );
    return settlement;
  });
}
export async function mutate(actor: Actor, action: string, input: unknown) {
  if (action === "book") return saveBook(actor, input);
  if (action === "student") return saveStudent(actor, input);
  if (action === "request")
    return submitRequest(
      actor,
      z.object({ bookId: z.string() }).parse(input).bookId,
    );
  if (action === "review") return reviewRequest(actor, input);
  if (action === "issue") return issueBook(actor, input);
  if (action === "return") return returnBook(actor, input);
  if (action === "settle") return settleFine(actor, input);
  if (action === "read-notifications")
    return db.notification.updateMany({
      where: { userId: actor.id },
      data: { read: true },
    });
  staff(actor);
  return transaction(async (tx) => {
    if (action === "category") {
      const { id, ...data } = categorySchema.parse(input);
      const category = id
        ? await tx.category.update({ where: { id }, data })
        : await tx.category.create({ data });
      await audit(tx, actor, "CATEGORY_SAVED", category.id, category.name);
      return category;
    }
    if (action === "archive-book") {
      const { id, archived } = z
        .object({ id: z.string(), archived: z.boolean() })
        .parse(input);
      assert(
        !(await tx.loan.count({
          where: { copy: { bookId: id }, returnedAt: null },
        })),
        "Return all active copies before archiving.",
      );
      assert(
        !(await tx.bookRequest.count({
          where: { bookId: id, status: { in: ["PENDING", "APPROVED"] } },
        })),
        "Resolve active requests before archiving.",
      );
      await tx.book.update({ where: { id }, data: { archived } });
      await audit(tx, actor, archived ? "BOOK_ARCHIVED" : "BOOK_RESTORED", id);
      return {};
    }
    if (action === "copy") {
      const { id, bookId, accession, status } = z
        .object({
          id: z.string().optional(),
          bookId: z.string(),
          accession: z.string().trim().min(1).max(80),
          status: z
            .enum(["AVAILABLE", "LOST", "MAINTENANCE"])
            .default("AVAILABLE"),
        })
        .parse(input);
      if (id)
        assert(
          !(await tx.loan.count({ where: { copyId: id, returnedAt: null } })),
          "Return this copy before changing its condition.",
        );
      const copy = id
        ? await tx.bookCopy.update({
            where: { id },
            data: { accession, status },
          })
        : await tx.bookCopy.create({ data: { bookId, accession, status } });
      await audit(tx, actor, "COPY_SAVED", copy.id, accession);
      return copy;
    }
    if (action === "settings") {
      admin(actor);
      const data = settingsSchema.parse(input);
      const settings = await tx.librarySettings.upsert({
        where: { id: "library" },
        create: data,
        update: data,
      });
      await audit(tx, actor, "SETTINGS_UPDATED", settings.id);
      return settings;
    }
    if (action === "staff") {
      admin(actor);
      const { id, password, ...data } = staffSchema.parse(input);
      assert(id || password, "A password is required.");
      assert(
        id !== actor.id || (data.role === "ADMIN" && data.active),
        "You cannot remove your own administrator access.",
      );
      if (id) {
        const existing = await tx.user.findUnique({ where: { id } });
        assert(
          existing && existing.role !== "STUDENT",
          "Manage students from the students module.",
        );
      }
      const passwordHash = password ? await hash(password, 12) : undefined;
      const user = id
        ? await tx.user.update({
            where: { id },
            data: { ...data, ...(passwordHash ? { passwordHash } : {}) },
          })
        : await tx.user.create({
            data: { ...data, passwordHash: passwordHash! },
          });
      if (id) await tx.session.deleteMany({ where: { userId: id } });
      await audit(
        tx,
        actor,
        "USER_SAVED",
        user.id,
        `${data.role}; active: ${data.active}`,
      );
      return { id: user.id };
    }
    assert(false, "Unknown action.", 404);
  });
}
