import { NextRequest, NextResponse } from "next/server";

import { downloadApplicantDocument } from "@/lib/server/registration-service";
import { toErrorResponse } from "@/lib/server/route-responses";
import { getApplicantToken } from "@/lib/server/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const file = await downloadApplicantDocument(await getApplicantToken(), documentId);
    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "content-type": file.mimeType,
        "content-disposition": `attachment; filename="${file.filename}"`
      }
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
