import { NextRequest, NextResponse } from "next/server";

import { getApplicantRegistration, updateApplicantRegistration } from "@/lib/server/registration-service";
import { toErrorResponse } from "@/lib/server/route-responses";
import { getApplicantToken } from "@/lib/server/session";

export async function GET() {
  try {
    const payload = await getApplicantRegistration(await getApplicantToken());
    return NextResponse.json(payload);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await updateApplicantRegistration(
      await getApplicantToken(),
      (await request.json()) as Record<string, string>
    );
    return NextResponse.json(payload);
  } catch (error) {
    return toErrorResponse(error);
  }
}
