export function PrimaryButton({ children, onClick }) {
  return <button onClick={onClick} className="w-full bg-blue-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-400 transition">{children}</button>;
}
