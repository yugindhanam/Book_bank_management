import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { mutate } from "@/lib/services";
import { checkOrigin, errorResponse } from "@/lib/http";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    checkOrigin(request);
    const actor = await requireUser();
    const { action } = await params;
    const result = await mutate(actor, action, await request.json());
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return errorResponse(error);
  }
}
