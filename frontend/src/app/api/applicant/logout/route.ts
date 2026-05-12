import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { backendFetchWithCookie } from "@/lib/api/backend";
import { APPLICANT_COOKIE_NAME } from "@/lib/session/constants";

export async function POST() {
  await backendFetchWithCookie("/applicant-sessions/logout", "applicant", { method: "POST" });
  const cookieStore = await cookies();
  cookieStore.delete(APPLICANT_COOKIE_NAME);
  return NextResponse.redirect(new URL("/lookup", "http://localhost:3000"));
}
