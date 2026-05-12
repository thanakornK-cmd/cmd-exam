import { AdminLoginForm } from "@/features/admin/components/admin-login-form";
import { PageShell } from "@/components/page-shell";

export default function AdminLoginPage() {
  return (
    <PageShell
      eyebrow="Admin access"
      title="Review registrations"
      description="Admins can browse all submissions, inspect document uploads, and generate name tag PDFs."
    >
      <AdminLoginForm />
    </PageShell>
  );
}
