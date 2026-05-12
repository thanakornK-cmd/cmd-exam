import { NextRequest, NextResponse } from "next/server";

import { backendFetchWithCookie } from "@/lib/api/backend";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const response = await backendFetchWithCookie(`/me/documents/${documentId}/download`, "applicant");
  const blob = await response.arrayBuffer();
  return new NextResponse(blob, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": response.headers.get("content-disposition") ?? ""
    }
  });
}
