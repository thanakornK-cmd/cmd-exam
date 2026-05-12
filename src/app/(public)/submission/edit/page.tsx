import Link from "next/link";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { RegistrationForm } from "@/features/registration/components/registration-form";
import { DocumentList } from "@/features/registration/components/document-list";
import { isAppError } from "@/lib/server/errors";
import { getApplicantRegistration } from "@/lib/server/registration-service";
import { getApplicantToken } from "@/lib/server/session";

export default async function EditSubmissionPage() {
  let registration;

  try {
    registration = await getApplicantRegistration(await getApplicantToken());
  } catch (error) {
    if (isAppError(error) && error.status === 401) {
      redirect("/lookup");
    }
    throw error;
  }

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
      <RegistrationForm
        mode="edit"
        initialValues={{
          full_name: registration.full_name,
          email: registration.email,
          phone: registration.phone,
          organization: registration.organization,
          job_title: registration.job_title,
          dietary_restrictions: registration.dietary_restrictions,
          emergency_contact_name: registration.emergency_contact_name,
          emergency_contact_phone: registration.emergency_contact_phone,
          notes: registration.notes
        }}
      />
      <DocumentList documents={registration.documents ?? []} />
    </PageShell>
  );
}
