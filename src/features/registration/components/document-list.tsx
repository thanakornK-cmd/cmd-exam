"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DocumentItem = {
  id: string;
  original_filename: string;
  created_at: string;
  replaced_document_id?: string;
};

export function DocumentList({ documents }: { documents: DocumentItem[] }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function addNew(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/applicant/me/documents", { method: "POST", body: formData });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.error ?? "Upload failed");
      setUploading(false);
      return;
    }
    router.refresh();
    setUploading(false);
  }

  async function replaceDocument(documentID: string, file: File) {
    setUploading(true);
    setMessage("");
    const formData = new FormData();
    formData.set("document", file);
    const response = await fetch(`/api/applicant/me/documents/${documentID}/replace`, {
      method: "POST",
      body: formData
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage(payload.error ?? "Replacement failed");
      setUploading(false);
      return;
    }
    router.refresh();
    setUploading(false);
  }

  return (
    <section className="card stack">
      <div className="actions">
        <span className="status">Documents</span>
      </div>
      <ul className="list">
        {documents.length === 0 ? (
          <li className="empty">No supporting documents uploaded yet.</li>
        ) : (
          documents.map((document) => (
            <li key={document.id} className="card">
              <div className="actions">
                <div>
                  <strong>{document.original_filename}</strong>
                  <div className="muted">
                    Uploaded {new Date(document.created_at).toLocaleString()}
                    {document.replaced_document_id ? " · replacement" : ""}
                  </div>
                </div>
                <a className="link" href={`/api/applicant/me/documents/${document.id}/download`}>
                  Download
                </a>
                <label className="button button--secondary">
                  Replace
                  <input
                    type="file"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void replaceDocument(document.id, file);
                      }
                    }}
                  />
                </label>
              </div>
            </li>
          ))
        )}
      </ul>
      <form onSubmit={addNew} className="stack">
        <input type="file" name="documents[]" multiple />
        <button className="button button--primary" type="submit" disabled={uploading}>
          {uploading ? "Uploading..." : "Add documents"}
        </button>
      </form>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
