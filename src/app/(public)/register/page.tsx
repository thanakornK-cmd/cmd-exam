import { PageShell } from "@/components/page-shell";
import { RegistrationForm } from "@/features/registration/components/registration-form";

export default function RegisterPage() {
  return (
    <PageShell
      eyebrow="Public registration"
      title="Register for the event"
      description="Submit your details, upload documents, and keep your reference code to return later."
    >
      <RegistrationForm />
    </PageShell>
  );
}
