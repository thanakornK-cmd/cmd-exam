import { NextRequest, NextResponse } from "next/server";

import { downloadNameTag } from "@/lib/server/registration-service";
import { toErrorResponse } from "@/lib/server/route-responses";
import { getAdminToken } from "@/lib/server/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const file = await downloadNameTag(await getAdminToken(), id);
    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${file.filename}"`
      }
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
