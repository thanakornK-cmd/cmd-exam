import { NextRequest, NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/server/route-responses";
import { createRegistration } from "@/lib/server/registration-service";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payload = await createRegistration(formData);
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
