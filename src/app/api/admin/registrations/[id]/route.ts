import { NextRequest, NextResponse } from "next/server";

import { getAdminRegistration } from "@/lib/server/registration-service";
import { toErrorResponse } from "@/lib/server/route-responses";
import { getAdminToken } from "@/lib/server/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await getAdminRegistration(await getAdminToken(), id);
    return NextResponse.json(payload);
  } catch (error) {
    return toErrorResponse(error);
  }
}
