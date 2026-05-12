type Row = {
  id: string;
  reference_code: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
};

export function RegistrationTable({ rows }: { rows: Row[] }) {
  return (
    <section className="card">
      <table className="table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <a className="link" href={`/admin/registrations/${row.id}`}>
                  {row.reference_code}
                </a>
              </td>
              <td>{row.full_name}</td>
              <td>{row.email}</td>
              <td>{row.phone}</td>
              <td>{row.status}</td>
              <td>{new Date(row.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
