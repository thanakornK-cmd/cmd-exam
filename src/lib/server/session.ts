import { cookies } from "next/headers";

import { ADMIN_COOKIE_NAME, APPLICANT_COOKIE_NAME, SESSION_COOKIE_SECURE } from "@/lib/session/constants";

export async function getApplicantToken() {
  const cookieStore = await cookies();
  return cookieStore.get(APPLICANT_COOKIE_NAME)?.value ?? "";
}

export async function getAdminToken() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? "";
}

export async function setApplicantToken(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(APPLICANT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: "lax",
    path: "/"
  });
}

export async function setAdminToken(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: "lax",
    path: "/"
  });
}

export async function clearApplicantToken() {
  const cookieStore = await cookies();
  cookieStore.delete(APPLICANT_COOKIE_NAME);
}

export async function clearAdminToken() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
