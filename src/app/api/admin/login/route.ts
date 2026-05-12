import { NextRequest, NextResponse } from "next/server";

import { adminLogin } from "@/lib/server/registration-service";
import { toErrorResponse } from "@/lib/server/route-responses";
import { setAdminToken } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { identifier?: string; password?: string };
    const payload = await adminLogin(body.identifier ?? "", body.password ?? "");
    await setAdminToken(payload.token);
    return NextResponse.json(payload);
  } catch (error) {
    return toErrorResponse(error);
  }
}
