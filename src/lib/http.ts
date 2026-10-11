import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError, assert } from "./rules";
export function checkOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN || request.nextUrl.origin;
  assert(origin === expected, "Request origin is not allowed.", 403);
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return NextResponse.json(
        { error: "A record with this identifier already exists." },
        { status: 409 },
      );
    if (error.code === "P2025")
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    if (["P2034", "P2003"].includes(error.code))
      return NextResponse.json(
        {
          error:
            "The record changed or is still in use. Refresh and try again.",
        },
        { status: 409 },
      );
  }
  console.error(
    "Operation failed:",
    error instanceof Error ? error.name : "Unknown error",
  );
  return NextResponse.json(
    { error: "Unable to complete this operation. Please try again." },
    { status: 500 },
  );
}
