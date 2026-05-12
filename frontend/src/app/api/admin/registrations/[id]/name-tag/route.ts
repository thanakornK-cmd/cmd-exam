import { NextRequest, NextResponse } from "next/server";

import { backendFetchWithCookie } from "@/lib/api/backend";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const response = await backendFetchWithCookie(`/admin/registrations/${id}/name-tag.pdf`, "admin");
  const blob = await response.arrayBuffer();
  return new NextResponse(blob, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/pdf",
      "content-disposition": response.headers.get("content-disposition") ?? ""
    }
  });
}
