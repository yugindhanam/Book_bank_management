import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { requireUser } from "@/lib/auth";
import { checkOrigin, errorResponse } from "@/lib/http";
import { saveStudent } from "@/lib/services";
import { assert } from "@/lib/rules";
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const actor = await requireUser(["ADMIN", "LIBRARIAN"]);
    const text = await request.text();
    assert(text.length <= 500_000, "CSV is too large (maximum 500 KB).");
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    });
    assert(parsed.data.length <= 200, "Import at most 200 students at a time.");
    assert(
      parsed.meta.fields?.includes("rollNumber") &&
        parsed.meta.fields.includes("email"),
      "CSV must contain rollNumber and email headers.",
    );
    const errors: string[] = parsed.errors.map(
      (e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`,
    );
    let imported = 0;
    for (const [i, row] of parsed.data.entries()) {
      if (parsed.errors.some((e) => e.row === i)) continue;
      try {
        await saveStudent(actor, {
          name: row.name,
          email: row.email,
          rollNumber: row.rollNumber,
          department: row.department,
          semester: row.semester,
          phone: row.phone || "",
          password: row.password,
          active: true,
        });
        imported++;
      } catch (error) {
        const response = errorResponse(error);
        const body = await response.json();
        errors.push(`Row ${i + 2}: ${body.error}`);
      }
    }
    return NextResponse.json({ imported, errors });
  } catch (error) {
    return errorResponse(error);
  }
}
