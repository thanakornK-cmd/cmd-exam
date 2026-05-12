type Registration = {
  reference_code: string;
  full_name: string;
  email: string;
  phone: string;
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
      </div>
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
