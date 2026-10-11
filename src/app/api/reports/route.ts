import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { report } from "@/lib/reports";
import { csv } from "@/lib/rules";
import { loanMoney } from "@/lib/queries";
import { errorResponse } from "@/lib/http";
export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser(["ADMIN", "LIBRARIAN"]);
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const data = await report(actor, params);
    const loans = params.type === "returns" ? data.returns : data.loans;
    return new NextResponse(
      csv([
        [
          "Transaction",
          "Student",
          "Roll number",
          "Book",
          "Accession",
          "Issued UTC",
          "Due UTC",
          "Returned UTC",
          "Fine paise",
          "Outstanding paise",
        ],
        ...loans.map((l) => [
          l.id,
          l.student.user.name,
          l.student.rollNumber,
          l.copy.book.title,
          l.copy.accession,
          l.issuedAt.toISOString(),
          l.dueAt.toISOString(),
          l.returnedAt?.toISOString() || "",
          loanMoney(l).assessed,
          loanMoney(l).outstanding,
        ]),
      ]),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="folio-${params.type === "returns" ? "returns" : "issues"}.csv"`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
