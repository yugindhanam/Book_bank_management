import { NextRequest, NextResponse } from "next/server";
import { signIn, signOut } from "@/lib/auth";
import { loginSchema } from "@/lib/schemas";
import { errorResponse, checkOrigin } from "@/lib/http";
export async function POST(request: NextRequest) {
  try {
    checkOrigin(request);
    const { email, password } = loginSchema.parse(await request.json());
    await signIn(email, password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    checkOrigin(request);
    await signOut();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
