type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function PageShell({ eyebrow, title, description, children }: Props) {
  return (
    <main className="shell">
      <div className="shell__inner stack">
        <section className="hero">
          {eyebrow ? <span className="hero__eyebrow">{eyebrow}</span> : null}
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </section>
        {children}
      </div>
    </main>
  );
}
