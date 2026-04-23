export function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="card stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}
