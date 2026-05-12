import { NextRequest, NextResponse } from "next/server";

import { replaceApplicantDocument } from "@/lib/server/registration-service";
import { toErrorResponse } from "@/lib/server/route-responses";
import { getApplicantToken } from "@/lib/server/session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const formData = await request.formData();
    const file = formData.get("document");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "document field is required" }, { status: 400 });
    }
    await replaceApplicantDocument(await getApplicantToken(), documentId, file);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
