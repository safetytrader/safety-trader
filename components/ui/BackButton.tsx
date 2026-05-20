// @ts-nocheck
export function BackButton({ onClick, label }) {
  return <button onClick={onClick} className="text-slate-400 hover:text-white text-sm whitespace-nowrap">← {label}</button>;
}
