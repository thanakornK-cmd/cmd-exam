import { NextRequest, NextResponse } from "next/server";

import { logoutApplicant } from "@/lib/server/registration-service";
import { clearApplicantToken, getApplicantToken } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  const token = await getApplicantToken();
  if (token) {
    await logoutApplicant(token);
  }
  await clearApplicantToken();
  return NextResponse.redirect(new URL("/lookup", request.url), 303);
}
