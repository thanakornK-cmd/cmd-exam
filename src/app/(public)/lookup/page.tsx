"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FormField } from "@/components/form-field";
import { PageShell } from "@/components/page-shell";

export default function LookupPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/applicant/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference_code: formData.get("reference_code"),
        password: formData.get("password")
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "Sign in failed");
      return;
    }
    router.push("/submission");
    router.refresh();
  }

  return (
    <PageShell
      eyebrow="Applicant access"
      title="Return to your submission"
      description="Use your reference code and password to review or edit what you already submitted."
    >
      <form onSubmit={onSubmit} className="card stack">
        <FormField name="reference_code" label="Reference code" required />
        <FormField name="password" label="Password" type="password" required />
        {error ? <p className="muted">{error}</p> : null}
        <div className="actions">
          <button className="button button--primary" type="submit">
            View submission
          </button>
        </div>
      </form>
    </PageShell>
  );
}
