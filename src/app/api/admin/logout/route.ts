import { NextResponse } from "next/server";

import { logoutAdmin } from "@/lib/server/registration-service";
import { clearAdminToken, getAdminToken } from "@/lib/server/session";

export async function POST() {
  const token = await getAdminToken();
  if (token) {
    await logoutAdmin(token);
  }
  await clearAdminToken();
  return NextResponse.json({ ok: true });
}
