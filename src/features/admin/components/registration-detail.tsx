"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Registration = {
  id: string;
  reference_code: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  documents: Array<{ id: string; original_filename: string; created_at: string }>;
};

export function RegistrationDetail({ registration }: { registration: Registration }) {
  const router = useRouter();
  const [status, setStatus] = useState(registration.status);
  const [errorMessage, setErrorMessage] = useState("");

  async function updateStatus(nextStatus: string) {
    setErrorMessage("");
    const response = await fetch(`/api/admin/registrations/${registration.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setErrorMessage(body?.error ?? "Failed to update registration status");
      return;
    }

    setStatus(nextStatus);
    router.refresh();
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="actions">
          <span className="status">{status}</span>
          <button className="button button--secondary" type="button" onClick={() => void updateStatus("reviewed")}>
            Mark reviewed
          </button>
          <a className="button button--primary" href={`/api/admin/registrations/${registration.id}/name-tag`}>
            Download name tag
          </a>
        </div>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        <div className="grid grid--2">
          <SummaryItem label="Reference code" value={registration.reference_code} />
          <SummaryItem label="Full name" value={registration.full_name} />
          <SummaryItem label="Email" value={registration.email} />
          <SummaryItem label="Phone" value={registration.phone} />
        </div>
      </section>
      <section className="card stack">
        <h2>Documents</h2>
        <ul className="list">
          {registration.documents?.map((document) => (
            <li key={document.id} className="actions">
              <span>{document.original_filename}</span>
              <a
                className="link"
                href={`/api/admin/registrations/${registration.id}/documents/${document.id}/download`}
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="muted">{label}</div>
      <div>{value}</div>
    </div>
  );
}
