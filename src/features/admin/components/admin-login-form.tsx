"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FormField } from "@/components/form-field";

export function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: formData.get("identifier"),
        password: formData.get("password")
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "Login failed");
      setSubmitting(false);
      return;
    }
    router.push("/admin/registrations");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card stack">
      <FormField name="identifier" label="Username or email" required />
      <FormField name="password" label="Password" type="password" required />
      {error ? <p className="muted">{error}</p> : null}
      <button className="button button--primary" disabled={submitting} type="submit">
        {submitting ? "Signing in..." : "Admin sign in"}
      </button>
    </form>
  );
}
