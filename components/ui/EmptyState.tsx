// @ts-nocheck
export function EmptyState({ icon, title, sub }) {
  return (
    <div className="text-center py-20 text-slate-400">
      <div className="text-5xl mb-3">{icon}</div>
      <p className="font-medium text-slate-600">{title}</p>
      <p className="text-sm">{sub}</p>
    </div>
  );
}
