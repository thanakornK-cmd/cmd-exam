import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { backendFetch } from "@/lib/api/backend";
import { APPLICANT_COOKIE_NAME, SESSION_COOKIE_SECURE } from "@/lib/session/constants";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const response = await backendFetch("/applicant-sessions", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" }
  });
  const payload = await response.json();
  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }
  const cookieStore = await cookies();
  cookieStore.set(APPLICANT_COOKIE_NAME, payload.token, {
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: "lax",
    path: "/"
  });
  return NextResponse.json(payload);
}
