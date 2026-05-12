import Link from "next/link";

import { PageShell } from "@/components/page-shell";

export default async function SuccessPage({
  searchParams
}: {
  searchParams: Promise<{ referenceCode?: string }>;
}) {
  const { referenceCode } = await searchParams;
  return (
    <PageShell
      eyebrow="Submitted"
      title="Registration received"
      description="Keep both your reference code and password. You need them to return and edit your submission."
    >
      <section className="card stack">
        <div>
          <div className="muted">Reference code</div>
          <h2>{referenceCode ?? "Unavailable"}</h2>
        </div>
        <div className="actions">
          <Link className="button button--primary" href="/lookup">
            View your submission
          </Link>
          <Link className="button button--secondary" href="/register">
            Submit another registration
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
