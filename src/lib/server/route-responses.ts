import { NextResponse } from "next/server";

import { isAppError } from "@/lib/server/errors";

export function toErrorResponse(error: unknown) {
  if (isAppError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ error: "internal server error" }, { status: 500 });
}
