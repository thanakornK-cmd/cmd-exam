"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { FileUpload } from "@/components/file-upload";
import { FormField } from "@/components/form-field";

type Props = {
  mode?: "create" | "edit";
  initialValues?: Partial<{
    full_name: string;
    email: string;
    phone: string;
  }>;
};

export function RegistrationForm({ mode = "create", initialValues = {} }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const endpoint = useMemo(() => (mode === "create" ? "/api/register" : "/api/applicant/me"), [mode]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch(endpoint, {
      method: mode === "create" ? "POST" : "PATCH",
      body: mode === "create" ? formData : JSON.stringify(Object.fromEntries(formData.entries())),
      headers: mode === "create" ? undefined : { "Content-Type": "application/json" }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setSubmitting(false);
      setError(payload.error ?? "Request failed");
      return;
    }
    if (mode === "create") {
      router.push(`/register/success?referenceCode=${encodeURIComponent(payload.reference_code)}`);
      return;
    }
    router.refresh();
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} className="card stack">
      <div className="grid grid--2">
        <FormField name="full_name" label="Full name" defaultValue={initialValues.full_name} required />
        <FormField name="email" label="Email" type="email" defaultValue={initialValues.email} required />
        <FormField name="phone" label="Phone" defaultValue={initialValues.phone} required />
      </div>
      {mode === "create" ? <FormField name="password" label="Password" type="password" required /> : null}
      {mode === "create" ? <FileUpload name="documents[]" label="Supporting documents" multiple /> : null}
      {error ? <p className="muted">{error}</p> : null}
      <div className="actions">
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? "Saving..." : mode === "create" ? "Submit registration" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
