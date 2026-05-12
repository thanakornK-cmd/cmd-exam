import { redirect } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { RegistrationDetail } from "@/features/admin/components/registration-detail";
import { isAppError } from "@/lib/server/errors";
import { getAdminRegistration } from "@/lib/server/registration-service";
import { getAdminToken } from "@/lib/server/session";

export default async function AdminRegistrationDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let registration;

  try {
    registration = await getAdminRegistration(await getAdminToken(), id);
  } catch (error) {
    if (isAppError(error) && error.status === 401) {
      redirect("/admin/login");
    }
    throw error;
  }

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
