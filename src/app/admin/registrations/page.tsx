import { redirect } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { RegistrationTable } from "@/features/admin/components/registration-table";
import { isAppError } from "@/lib/server/errors";
import { listAdminRegistrations } from "@/lib/server/registration-service";
import { getAdminToken } from "@/lib/server/session";

export default async function AdminRegistrationsPage({
  searchParams
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  let payload;

  try {
    payload = await listAdminRegistrations({
      token: await getAdminToken(),
      search: params.search ?? ""
    });
  } catch (error) {
    if (isAppError(error) && error.status === 401) {
      redirect("/admin/login");
    }
    throw error;
  }

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
