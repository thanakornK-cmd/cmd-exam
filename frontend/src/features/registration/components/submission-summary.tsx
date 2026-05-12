type Registration = {
  reference_code: string;
  full_name: string;
  email: string;
  phone: string;
  organization: string;
  job_title: string;
  dietary_restrictions: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  notes: string;
  status: string;
};

export function SubmissionSummary({ registration }: { registration: Registration }) {
  return (
    <section className="card stack">
      <div className="actions">
        <span className="status">{registration.status}</span>
      </div>
      <div className="grid grid--2">
        <SummaryItem label="Reference code" value={registration.reference_code} />
        <SummaryItem label="Full name" value={registration.full_name} />
        <SummaryItem label="Email" value={registration.email} />
        <SummaryItem label="Phone" value={registration.phone} />
        <SummaryItem label="Organization" value={registration.organization || "-"} />
        <SummaryItem label="Job title" value={registration.job_title || "-"} />
        <SummaryItem label="Dietary restrictions" value={registration.dietary_restrictions || "-"} />
        <SummaryItem label="Emergency contact" value={registration.emergency_contact_name || "-"} />
        <SummaryItem label="Emergency phone" value={registration.emergency_contact_phone || "-"} />
      </div>
      <SummaryItem label="Notes" value={registration.notes || "-"} />
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="muted">{label}</div>
      <div>{value}</div>
    </div>
  );
}
