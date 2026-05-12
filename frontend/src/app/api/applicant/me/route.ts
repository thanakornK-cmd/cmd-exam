import { NextRequest, NextResponse } from "next/server";

import { backendFetchWithCookie } from "@/lib/api/backend";

export async function GET() {
  const response = await backendFetchWithCookie("/me/registration", "applicant");
  const payload = await response.text();
  return new NextResponse(payload, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.text();
  const response = await backendFetchWithCookie("/me/registration", "applicant", {
    method: "PATCH",
    body,
    headers: { "Content-Type": "application/json" }
  });
  const payload = await response.text();
  return new NextResponse(payload, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
}
