import { NextRequest, NextResponse } from "next/server";

import { backendFetchWithCookie } from "@/lib/api/backend";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const { id, documentId } = await params;
  const response = await backendFetchWithCookie(
    `/admin/registrations/${id}/documents/${documentId}/download`,
    "admin"
  );
  const blob = await response.arrayBuffer();
  return new NextResponse(blob, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": response.headers.get("content-disposition") ?? ""
    }
  });
}
