"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { FormField } from "@/components/form-field";
import {
  appendPendingUploads,
  removePendingUpload,
  type PendingUpload
} from "@/features/registration/components/pending-upload-queue";

const DOCUMENT_ACCEPT = ".pdf,.png,.jpg,.jpeg,.doc,.docx";
const DOCUMENT_HINT = "Supported file types: PDF, PNG, JPG, JPEG, DOC, DOCX. You can upload multiple files.";

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
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  const endpoint = useMemo(() => (mode === "create" ? "/api/register" : "/api/applicant/me"), [mode]);

  function onSelectDocuments(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setPendingUploads((current) => appendPendingUploads(current, files));
    event.target.value = "";
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = event.currentTarget;
    const baseFormData = new FormData(form);
    const formData =
      mode === "create"
        ? (() => {
            const nextFormData = new FormData();
            nextFormData.set("full_name", String(baseFormData.get("full_name") ?? ""));
            nextFormData.set("email", String(baseFormData.get("email") ?? ""));
            nextFormData.set("phone", String(baseFormData.get("phone") ?? ""));
            nextFormData.set("password", String(baseFormData.get("password") ?? ""));
            pendingUploads.forEach((upload) => nextFormData.append("documents[]", upload.file));
            return nextFormData;
          })()
        : baseFormData;
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
      {mode === "create" ? (
        <section className="stack">
          <div className="field">
            <label htmlFor="documents">Upload Documents</label>
            <div className="actions">
              <input
                id="documents"
                type="file"
                multiple
                accept={DOCUMENT_ACCEPT}
                onChange={onSelectDocuments}
              />
            </div>
            <p className="muted">{DOCUMENT_HINT}</p>
          </div>
          <ul className="list">
            {pendingUploads.length === 0 ? (
              <li className="empty">No files selected yet.</li>
            ) : (
              pendingUploads.map((upload) => (
                <li key={upload.id} className="card">
                  <div className="actions">
                    <div>
                      <strong>{upload.file.name}</strong>
                      <div className="muted">{Math.max(1, Math.round(upload.file.size / 1024))} KB</div>
                    </div>
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => setPendingUploads((current) => removePendingUpload(current, upload.id))}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}
      {error ? <p className="muted">{error}</p> : null}
      <div className="actions">
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? "Saving..." : mode === "create" ? "Submit registration" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
