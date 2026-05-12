import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { backendFetchWithCookie } from "@/lib/api/backend";
import { ADMIN_COOKIE_NAME } from "@/lib/session/constants";

export async function POST() {
  await backendFetchWithCookie("/admin-sessions/logout", "admin", { method: "POST" });
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
