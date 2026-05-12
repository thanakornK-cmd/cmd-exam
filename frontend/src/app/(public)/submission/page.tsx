import Link from "next/link";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { backendFetchWithCookie } from "@/lib/api/backend";
import { SubmissionSummary } from "@/features/registration/components/submission-summary";
import { DocumentList } from "@/features/registration/components/document-list";

export default async function SubmissionPage() {
  const response = await backendFetchWithCookie("/me/registration", "applicant");
  if (response.status === 401) {
    redirect("/lookup");
  }
  const registration = await response.json();
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
