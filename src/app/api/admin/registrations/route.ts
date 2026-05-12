import { NextRequest, NextResponse } from "next/server";

import { listAdminRegistrations } from "@/lib/server/registration-service";
import { toErrorResponse } from "@/lib/server/route-responses";
import { getAdminToken } from "@/lib/server/session";

export async function GET(request: NextRequest) {
  try {
    const payload = await listAdminRegistrations({
      token: await getAdminToken(),
      search: request.nextUrl.searchParams.get("search") ?? "",
      page: Number(request.nextUrl.searchParams.get("page") ?? "1"),
      pageSize: Number(request.nextUrl.searchParams.get("page_size") ?? "20")
    });
    return NextResponse.json(payload);
  } catch (error) {
    return toErrorResponse(error);
  }
}
