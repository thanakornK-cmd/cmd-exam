import { NextRequest, NextResponse } from "next/server";

import { loginApplicant } from "@/lib/server/registration-service";
import { toErrorResponse } from "@/lib/server/route-responses";
import { setApplicantToken } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { reference_code?: string; password?: string };
    const payload = await loginApplicant(body.reference_code ?? "", body.password ?? "");
    await setApplicantToken(payload.token);
    return NextResponse.json(payload);
  } catch (error) {
    return toErrorResponse(error);
  }
}
