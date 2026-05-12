import Link from "next/link";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { RegistrationForm } from "@/features/registration/components/registration-form";
import { DocumentList } from "@/features/registration/components/document-list";
import { backendFetchWithCookie } from "@/lib/api/backend";

export default async function EditSubmissionPage() {
  const response = await backendFetchWithCookie("/me/registration", "applicant");
  if (response.status === 401) {
    redirect("/lookup");
  }
  const registration = await response.json();
  return (
    <PageShell
      eyebrow="Edit submission"
      title="Update your registration"
      description="Change fields, add new supporting documents, or replace an existing document without losing the old audit trail."
    >
      <div className="actions">
        <Link className="button button--secondary" href="/submission">
          Back to summary
        </Link>
      </div>
      <RegistrationForm mode="edit" initialValues={registration} />
      <DocumentList documents={registration.documents ?? []} />
    </PageShell>
  );
}
