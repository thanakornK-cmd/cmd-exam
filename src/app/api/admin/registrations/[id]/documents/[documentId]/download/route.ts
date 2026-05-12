import { NextRequest, NextResponse } from "next/server";

import { downloadAdminDocument } from "@/lib/server/registration-service";
import { toErrorResponse } from "@/lib/server/route-responses";
import { getAdminToken } from "@/lib/server/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const { id, documentId } = await params;
    const file = await downloadAdminDocument(await getAdminToken(), id, documentId);
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
