import { NextRequest, NextResponse } from "next/server";

import { addApplicantDocuments } from "@/lib/server/registration-service";
import { toErrorResponse } from "@/lib/server/route-responses";
import { getApplicantToken } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  try {
    await addApplicantDocuments(await getApplicantToken(), await request.formData());
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
