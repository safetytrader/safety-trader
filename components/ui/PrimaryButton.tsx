// @ts-nocheck
export function PrimaryButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/15 transition hover:bg-blue-500"
    >
      {children}
    </button>
  );
}
