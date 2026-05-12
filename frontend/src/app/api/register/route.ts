import { NextRequest, NextResponse } from "next/server";

import { backendFetch } from "@/lib/api/backend";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const response = await backendFetch("/registrations", {
    method: "POST",
    body: formData
  });
  const payload = await response.text();
  return new NextResponse(payload, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" }
  });
}
