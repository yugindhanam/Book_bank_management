import { z } from "zod";
const text = z.string().trim().min(1).max(200);
export const loginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1).max(128),
});
export const bookSchema = z.object({
  id: z.string().optional(),
  title: text,
  author: text,
  isbn: z
    .string()
    .trim()
    .max(32)
    .nullish()
    .transform((v) => v || null),
  categoryId: text,
  publisher: z.string().max(200).default(""),
  edition: z.string().max(80).default(""),
  year: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(1000).max(2200).nullable(),
  ),
  description: z.string().max(5000).default(""),
  coverUrl: z
    .union([
      z.literal(""),
      z.url().refine((v) => v.startsWith("https://"), "Use an HTTPS image URL"),
    ])
    .nullish()
    .transform((v) => v || null),
  shelf: text,
  copies: z.coerce.number().int().min(1).max(100).default(1),
});
export const studentSchema = z.object({
  id: z.string().optional(),
  name: text,
  email: z.email().toLowerCase(),
  rollNumber: text,
  department: text,
  semester: z.coerce.number().int().min(1).max(12),
  phone: z.string().max(30).default(""),
  password: z.string().min(12).max(128).optional(),
  active: z.boolean().default(true),
});
export const categorySchema = z.object({
  id: z.string().optional(),
  name: text,
  description: z.string().max(500).default(""),
  archived: z.boolean().default(false),
});
export const settingsSchema = z.object({
  name: text,
  loanDays: z.coerce.number().int().min(1).max(365),
  maxLoans: z.coerce.number().int().min(1).max(30),
  dailyFine: z.coerce.number().int().min(0).max(100000),
  graceDays: z.coerce.number().int().min(0).max(30),
});
export const staffSchema = z.object({
  id: z.string().optional(),
  name: text,
  email: z.email().toLowerCase(),
  role: z.enum(["ADMIN", "LIBRARIAN"]),
  password: z.string().min(12).max(128).optional(),
  active: z.boolean().default(true),
});
