import { redirect } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { RegistrationTable } from "@/features/admin/components/registration-table";
import { backendFetchWithCookie } from "@/lib/api/backend";

export default async function AdminRegistrationsPage({
  searchParams
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.search) {
    query.set("search", params.search);
  }
  const response = await backendFetchWithCookie(`/admin/registrations?${query.toString()}`, "admin");
  if (response.status === 401) {
    redirect("/admin/login");
  }
  const payload = await response.json();
  return (
    <PageShell
      eyebrow="Admin dashboard"
      title="Registrations"
      description="Browse all attendee submissions and open any record for detail, documents, and name tag download."
    >
      <section className="card">
        <form className="actions">
          <input name="search" placeholder="Search by name, email, or reference code" defaultValue={params.search} />
          <button className="button button--secondary" type="submit">
            Search
          </button>
        </form>
      </section>
      <RegistrationTable rows={payload.items ?? []} />
    </PageShell>
  );
}
