import { NextRequest, NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/server/route-responses";
import { updateRegistrationStatus } from "@/lib/server/registration-service";
import { getAdminToken } from "@/lib/server/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { status?: string };
    const payload = await updateRegistrationStatus(await getAdminToken(), id, body.status ?? "");
    return NextResponse.json(payload);
  } catch (error) {
    return toErrorResponse(error);
  }
}
