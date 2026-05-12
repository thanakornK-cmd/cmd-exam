# Event Registration Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js application with a BFF layer for registration submission, applicant self-service, and admin management that consumes the Go backend API and exposes a complete judgeable user flow.

**Architecture:** The frontend uses the Next.js App Router for pages and route handlers. Browser code never talks directly to the Go backend; instead, BFF handlers proxy requests, manage secure cookies, and normalize backend errors into UI-friendly responses. Feature modules separate public registration, applicant self-service, and admin workflows.

**Tech Stack:** Next.js 16+, TypeScript, React, App Router, route handlers, `zod`, `react-hook-form`, Playwright, Vitest, Testing Library

---

## Repository Structure

```text
event-register-frontend/
  src/app/layout.tsx
  src/app/globals.css
  src/app/page.tsx
  src/app/(public)/register/page.tsx
  src/app/(public)/register/success/page.tsx
  src/app/(public)/lookup/page.tsx
  src/app/(public)/submission/page.tsx
  src/app/(public)/submission/edit/page.tsx
  src/app/admin/login/page.tsx
  src/app/admin/registrations/page.tsx
  src/app/admin/registrations/[id]/page.tsx
  src/app/api/register/route.ts
  src/app/api/applicant/login/route.ts
  src/app/api/applicant/logout/route.ts
  src/app/api/applicant/me/route.ts
  src/app/api/applicant/me/documents/route.ts
  src/app/api/applicant/me/documents/[documentId]/replace/route.ts
  src/app/api/admin/login/route.ts
  src/app/api/admin/logout/route.ts
  src/app/api/admin/registrations/route.ts
  src/app/api/admin/registrations/[id]/route.ts
  src/app/api/admin/registrations/[id]/status/route.ts
  src/app/api/admin/registrations/[id]/name-tag/route.ts
  src/components/form-field.tsx
  src/components/file-upload.tsx
  src/components/page-shell.tsx
  src/components/data-table.tsx
  src/features/registration/components/registration-form.tsx
  src/features/registration/components/submission-summary.tsx
  src/features/registration/components/document-list.tsx
  src/features/registration/lib/schemas.ts
  src/features/registration/lib/mappers.ts
  src/features/admin/components/admin-login-form.tsx
  src/features/admin/components/registration-table.tsx
  src/features/admin/components/registration-detail.tsx
  src/features/admin/lib/schemas.ts
  src/features/auth/lib/cookies.ts
  src/lib/api/backend.ts
  src/lib/api/errors.ts
  src/lib/session/applicant-session.ts
  src/lib/session/admin-session.ts
  src/types/api.ts
  tests/unit/registration-schema.test.ts
  tests/unit/error-mapper.test.ts
  tests/e2e/judge-flow.spec.ts
  .env.example
  playwright.config.ts
  vitest.config.ts
  README.md
```

## Environment Variables

```env
NEXT_PUBLIC_APP_NAME=CMD AI Adoption Exam 2026
BACKEND_API_BASE_URL=http://localhost:8080/api/v1
APPLICANT_COOKIE_NAME=applicant_session
ADMIN_COOKIE_NAME=admin_session
SESSION_COOKIE_SECURE=false
```

## Page Outline

### Public / Applicant

- `/register`
  - form fields for attendee info
  - password creation
  - multi-file upload
- `/register/success`
  - show reference code
  - show reminder to keep password
- `/lookup`
  - reference code + password login
- `/submission`
  - read-only summary and document list
- `/submission/edit`
  - editable fields
  - add document
  - replace document

### Admin

- `/admin/login`
  - username/email + password
- `/admin/registrations`
  - searchable registration table
- `/admin/registrations/[id]`
  - full registration detail
  - document download actions
  - name tag download action

## BFF Contract

The frontend owns proxy handlers under `src/app/api/*`.

- Browser submits to Next.js
- Route handler forwards to backend
- Route handler reads backend response
- Route handler sets or clears secure HTTP-only cookies when needed
- Route handler maps backend validation payloads to stable frontend JSON shapes

## Implementation Tasks

### Task 1: Bootstrap the Next.js app and shared layout

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Create the app shell**

Run: `npx create-next-app@latest event-register-frontend --ts --app --eslint --src-dir`
Expected: Next.js project scaffold exists

- [ ] **Step 2: Create a simple landing redirect**

```tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/register");
}
```

- [ ] **Step 3: Add base layout**

```tsx
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Start the app locally**

Run: `npm run dev`
Expected: app loads and `/` redirects to `/register`

- [ ] **Step 5: Commit**

```bash
git add src/app .env.example README.md package.json package-lock.json tsconfig.json
git commit -m "chore: bootstrap frontend app"
```

### Task 2: Add typed backend client, error helpers, and session cookie utilities

**Files:**
- Create: `src/lib/api/backend.ts`
- Create: `src/lib/api/errors.ts`
- Create: `src/lib/session/applicant-session.ts`
- Create: `src/lib/session/admin-session.ts`
- Create: `src/features/auth/lib/cookies.ts`
- Create: `src/types/api.ts`
- Create: `tests/unit/error-mapper.test.ts`

- [ ] **Step 1: Write the failing error-mapper test**

```ts
import { describe, expect, it } from "vitest";
import { mapBackendValidationErrors } from "@/lib/api/errors";

describe("mapBackendValidationErrors", () => {
  it("maps field errors into a record", () => {
    const result = mapBackendValidationErrors({
      errors: [{ field: "email", message: "invalid email" }],
    });
    expect(result.email).toBe("invalid email");
  });
});
```

- [ ] **Step 2: Run the unit test**

Run: `npm run test -- error-mapper`
Expected: FAIL because helpers are missing

- [ ] **Step 3: Create the backend fetch wrapper**

```ts
export async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${process.env.BACKEND_API_BASE_URL}${path}`, init);
  if (!response.ok) {
    throw await toBackendError(response);
  }
  return response.json() as Promise<T>;
}
```

- [ ] **Step 4: Add cookie helpers**

```ts
export const APPLICANT_COOKIE_NAME = process.env.APPLICANT_COOKIE_NAME ?? "applicant_session";
export const ADMIN_COOKIE_NAME = process.env.ADMIN_COOKIE_NAME ?? "admin_session";
```

- [ ] **Step 5: Re-run the unit test**

Run: `npm run test -- error-mapper`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib src/features/auth src/types tests/unit/error-mapper.test.ts
git commit -m "feat: add frontend api and session utilities"
```

### Task 3: Build registration form schemas and UI components

**Files:**
- Create: `src/components/form-field.tsx`
- Create: `src/components/file-upload.tsx`
- Create: `src/components/page-shell.tsx`
- Create: `src/features/registration/components/registration-form.tsx`
- Create: `src/features/registration/lib/schemas.ts`
- Create: `tests/unit/registration-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

```ts
import { describe, expect, it } from "vitest";
import { registrationSchema } from "@/features/registration/lib/schemas";

describe("registrationSchema", () => {
  it("rejects short passwords", () => {
    const result = registrationSchema.safeParse({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      phone: "0812345678",
      password: "short",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the schema test**

Run: `npm run test -- registration-schema`
Expected: FAIL because schema file is missing

- [ ] **Step 3: Implement the Zod schema**

```ts
export const registrationSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.email("Enter a valid email"),
  phone: z.string().min(1, "Phone is required"),
  organization: z.string().default(""),
  jobTitle: z.string().default(""),
  dietaryRestrictions: z.string().default(""),
  emergencyContactName: z.string().default(""),
  emergencyContactPhone: z.string().default(""),
  notes: z.string().default(""),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
```

- [ ] **Step 4: Build the form and upload components**

```tsx
<form action={formAction} className="space-y-6">
  <FormField name="fullName" label="Full name" />
  <FormField name="email" label="Email" type="email" />
  <FormField name="phone" label="Phone" />
  <FileUpload name="documents" multiple />
</form>
```

- [ ] **Step 5: Re-run schema tests**

Run: `npm run test -- registration-schema`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components src/features/registration tests/unit/registration-schema.test.ts
git commit -m "feat: add registration form schemas and components"
```

### Task 4: Implement registration BFF route and public registration pages

**Files:**
- Create: `src/app/(public)/register/page.tsx`
- Create: `src/app/(public)/register/success/page.tsx`
- Create: `src/app/api/register/route.ts`
- Create: `src/features/registration/components/submission-summary.tsx`
- Modify: `src/features/registration/components/registration-form.tsx`

- [ ] **Step 1: Create the BFF registration proxy**

```ts
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const response = await fetch(`${process.env.BACKEND_API_BASE_URL}/registrations`, {
    method: "POST",
    body: formData,
  });
  return forwardResponse(response);
}
```

- [ ] **Step 2: Wire the registration page to submit through Next.js**

```tsx
export default function RegisterPage() {
  return (
    <PageShell title="Event registration">
      <RegistrationForm />
    </PageShell>
  );
}
```

- [ ] **Step 3: Redirect success flow with reference code**

```tsx
redirect(`/register/success?referenceCode=${encodeURIComponent(result.reference_code)}`);
```

- [ ] **Step 4: Verify the flow manually**

Run: `npm run dev`
Expected: `/register` renders, submits to `/api/register`, and navigates to `/register/success`

- [ ] **Step 5: Commit**

```bash
git add src/app/(public) src/app/api/register src/features/registration/components/submission-summary.tsx src/features/registration/components/registration-form.tsx
git commit -m "feat: add public registration flow"
```

### Task 5: Implement applicant login BFF and self-service pages

**Files:**
- Create: `src/app/(public)/lookup/page.tsx`
- Create: `src/app/(public)/submission/page.tsx`
- Create: `src/app/(public)/submission/edit/page.tsx`
- Create: `src/app/api/applicant/login/route.ts`
- Create: `src/app/api/applicant/logout/route.ts`
- Create: `src/app/api/applicant/me/route.ts`
- Create: `src/features/registration/components/document-list.tsx`

- [ ] **Step 1: Create applicant login proxy**

```ts
export async function POST(request: NextRequest) {
  const payload = await request.json();
  const result = await backendFetch<{ token: string }>("/applicant-sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const response = NextResponse.json({ ok: true });
  setApplicantSessionCookie(response, result.token);
  return response;
}
```

- [ ] **Step 2: Add lookup page form**

```tsx
<form action="/api/applicant/login" method="post">
  <FormField name="referenceCode" label="Reference code" />
  <FormField name="password" label="Password" type="password" />
</form>
```

- [ ] **Step 3: Build submission summary page**

```tsx
const registration = await getApplicantRegistration();
return <SubmissionSummary registration={registration} />;
```

- [ ] **Step 4: Build edit page with existing values**

```tsx
const registration = await getApplicantRegistration();
return <RegistrationForm initialValues={registration} mode="edit" />;
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(public)/lookup src/app/(public)/submission src/app/api/applicant src/features/registration/components/document-list.tsx
git commit -m "feat: add applicant self-service pages"
```

### Task 6: Implement applicant document add/replace BFF routes and edit UX

**Files:**
- Create: `src/app/api/applicant/me/documents/route.ts`
- Create: `src/app/api/applicant/me/documents/[documentId]/replace/route.ts`
- Modify: `src/features/registration/components/registration-form.tsx`
- Modify: `src/features/registration/components/document-list.tsx`
- Modify: `src/app/(public)/submission/edit/page.tsx`

- [ ] **Step 1: Add BFF proxy for new documents**

```ts
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  return proxyMultipart(request, "/me/documents", formData, "POST");
}
```

- [ ] **Step 2: Add BFF proxy for replacement**

```ts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const formData = await request.formData();
  return proxyMultipart(request, `/me/documents/${documentId}/replace`, formData, "POST");
}
```

- [ ] **Step 3: Add document actions to the edit UI**

```tsx
<DocumentList
  documents={registration.documents}
  onReplaceAction={`/api/applicant/me/documents/${document.id}/replace`}
/>
```

- [ ] **Step 4: Manually verify add/replace flow**

Run: `npm run dev`
Expected: edit page can upload a new file and replace an existing file through Next.js routes

- [ ] **Step 5: Commit**

```bash
git add src/app/api/applicant/me/documents src/features/registration/components src/app/(public)/submission/edit/page.tsx
git commit -m "feat: add applicant document management flow"
```

### Task 7: Implement admin login and registration list/detail pages

**Files:**
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/admin/registrations/page.tsx`
- Create: `src/app/admin/registrations/[id]/page.tsx`
- Create: `src/app/api/admin/login/route.ts`
- Create: `src/app/api/admin/logout/route.ts`
- Create: `src/app/api/admin/registrations/route.ts`
- Create: `src/app/api/admin/registrations/[id]/route.ts`
- Create: `src/features/admin/components/admin-login-form.tsx`
- Create: `src/features/admin/components/registration-table.tsx`
- Create: `src/features/admin/components/registration-detail.tsx`
- Create: `src/components/data-table.tsx`

- [ ] **Step 1: Add admin login BFF route**

```ts
export async function POST(request: NextRequest) {
  const payload = await request.json();
  const result = await backendFetch<{ token: string }>("/admin-sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const response = NextResponse.json({ ok: true });
  setAdminSessionCookie(response, result.token);
  return response;
}
```

- [ ] **Step 2: Build admin login page**

```tsx
export default function AdminLoginPage() {
  return (
    <PageShell title="Admin sign in">
      <AdminLoginForm />
    </PageShell>
  );
}
```

- [ ] **Step 3: Build registration list page**

```tsx
const registrations = await getAdminRegistrations(searchParams);
return <RegistrationTable rows={registrations.items} />;
```

- [ ] **Step 4: Build registration detail page**

```tsx
const registration = await getAdminRegistrationById(params.id);
return <RegistrationDetail registration={registration} />;
```

- [ ] **Step 5: Commit**

```bash
git add src/app/admin src/app/api/admin src/features/admin src/components/data-table.tsx
git commit -m "feat: add admin ui and bff routes"
```

### Task 8: Add admin status update and name-tag download flows

**Files:**
- Create: `src/app/api/admin/registrations/[id]/status/route.ts`
- Create: `src/app/api/admin/registrations/[id]/name-tag/route.ts`
- Modify: `src/features/admin/components/registration-detail.tsx`

- [ ] **Step 1: Add status update route**

```ts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payload = await request.json();
  return proxyJSON(request, `/admin/registrations/${id}/status`, payload, "POST");
}
```

- [ ] **Step 2: Add PDF download route**

```ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBinary(request, `/admin/registrations/${id}/name-tag.pdf`);
}
```

- [ ] **Step 3: Add detail-page actions**

```tsx
<a href={`/api/admin/registrations/${registration.id}/name-tag`} target="_blank">
  Download name tag PDF
</a>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/registrations/[id] src/features/admin/components/registration-detail.tsx
git commit -m "feat: add admin status and pdf actions"
```

### Task 9: Add end-to-end coverage for the judged flow

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/judge-flow.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the E2E test**

```ts
import { expect, test } from "@playwright/test";

test("judge flow", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Phone").fill("0812345678");
  await page.getByLabel("Password").fill("secret123");
  await page.getByRole("button", { name: /submit/i }).click();
  await expect(page).toHaveURL(/register\/success/);
});
```

- [ ] **Step 2: Run the E2E test**

Run: `npx playwright test tests/e2e/judge-flow.spec.ts`
Expected: FAIL until backend and pages are fully wired

- [ ] **Step 3: Extend the test through lookup, edit, admin login, detail view, and PDF download**

```ts
await page.goto("/lookup");
await page.getByLabel("Reference code").fill(referenceCode);
await page.getByLabel("Password").fill("secret123");
await page.getByRole("button", { name: /sign in/i }).click();
await expect(page).toHaveURL(/submission/);
```

- [ ] **Step 4: Re-run the E2E suite after backend integration is ready**

Run: `npx playwright test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/judge-flow.spec.ts README.md
git commit -m "test: add judged flow end-to-end coverage"
```

### Task 10: Final polish, env docs, and Vercel deployment steps

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Document local setup**

```text
1. Set BACKEND_API_BASE_URL to the running Go API
2. Run npm install
3. Run npm run dev
4. Open /register and /admin/login
```

- [ ] **Step 2: Document Vercel deployment**

```text
1. Import the frontend repo into Vercel
2. Set BACKEND_API_BASE_URL to the public backend API URL ending in /api/v1
3. Set secure cookie mode for production
4. Redeploy and smoke test the judge flow
```

- [ ] **Step 3: Run all frontend checks**

Run: `npm run test && npx playwright test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add README.md .env.example
git commit -m "chore: add frontend deployment docs"
```

## Frontend Test Checklist

- [ ] `npm run test`
- [ ] `npx playwright test`
- [ ] manual registration submit through `/register`
- [ ] manual applicant lookup through `/lookup`
- [ ] manual applicant edit through `/submission/edit`
- [ ] manual admin login through `/admin/login`
- [ ] manual admin detail + PDF through `/admin/registrations/[id]`

## Frontend Deployment Checklist

- [ ] Import repo into Vercel
- [ ] Set `BACKEND_API_BASE_URL` to the public Go API URL with `/api/v1`
- [ ] Set cookie security flags for production
- [ ] Deploy and open the public URL
- [ ] Verify register, lookup, edit, admin list, admin detail, and PDF download flows
