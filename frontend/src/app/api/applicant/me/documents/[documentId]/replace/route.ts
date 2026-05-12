import { NextRequest, NextResponse } from "next/server";

import { backendFetchWithCookie } from "@/lib/api/backend";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const formData = await request.formData();
  const response = await backendFetchWithCookie(`/me/documents/${documentId}/replace`, "applicant", {
    method: "POST",
    body: formData
  });
  const payload = await response.text();
  return new NextResponse(payload, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
}
