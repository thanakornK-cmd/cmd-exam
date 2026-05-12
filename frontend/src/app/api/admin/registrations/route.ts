import { NextRequest, NextResponse } from "next/server";

import { backendFetchWithCookie } from "@/lib/api/backend";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const response = await backendFetchWithCookie(`/admin/registrations?${query}`, "admin");
  const payload = await response.text();
  return new NextResponse(payload, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
}
