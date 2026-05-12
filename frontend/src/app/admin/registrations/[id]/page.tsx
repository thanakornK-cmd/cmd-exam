import { redirect } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { RegistrationDetail } from "@/features/admin/components/registration-detail";
import { backendFetchWithCookie } from "@/lib/api/backend";

export default async function AdminRegistrationDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const response = await backendFetchWithCookie(`/admin/registrations/${id}`, "admin");
  if (response.status === 401) {
    redirect("/admin/login");
  }
  const registration = await response.json();
  return (
    <PageShell
      eyebrow="Admin detail"
      title={registration.full_name}
      description="Inspect this registration, download original files, or generate the attendee's name tag PDF."
    >
      <RegistrationDetail registration={registration} />
    </PageShell>
  );
}
