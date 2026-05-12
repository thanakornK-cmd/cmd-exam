import Link from "next/link";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { SubmissionSummary } from "@/features/registration/components/submission-summary";
import { DocumentList } from "@/features/registration/components/document-list";
import { isAppError } from "@/lib/server/errors";
import { getApplicantRegistration } from "@/lib/server/registration-service";
import { getApplicantToken } from "@/lib/server/session";

export default async function SubmissionPage() {
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
      eyebrow="Your submission"
      title="Review what you submitted"
      description="You can inspect your current information, download your documents, or switch to edit mode."
    >
      <div className="actions">
        <Link className="button button--primary" href="/submission/edit">
          Edit submission
        </Link>
        <form action="/api/applicant/logout" method="post">
          <button className="button button--secondary" type="submit">
            Sign out
          </button>
        </form>
      </div>
      <SubmissionSummary registration={registration} />
      <DocumentList documents={registration.documents ?? []} />
    </PageShell>
  );
}
