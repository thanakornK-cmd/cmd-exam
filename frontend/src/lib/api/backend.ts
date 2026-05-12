import { cookies } from "next/headers";

import { ADMIN_COOKIE_NAME, APPLICANT_COOKIE_NAME } from "@/lib/session/constants";

const baseURL = process.env.BACKEND_API_BASE_URL ?? "http://localhost:8080/api/v1";

export async function backendFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    ...init,
    cache: "no-store"
  });
  return response;
}

export async function backendFetchWithCookie(
  path: string,
  actor: "applicant" | "admin",
  init: RequestInit = {}
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(actor === "admin" ? ADMIN_COOKIE_NAME : APPLICANT_COOKIE_NAME)?.value;
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return backendFetch(path, { ...init, headers });
}
