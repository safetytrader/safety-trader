// @ts-nocheck
export function AppHeader({ left, right, title, sub, user }) {
  return (
    <header className="bg-slate-900 text-white px-6 py-4 flex items-center gap-4 shadow">
      {left}{left && <div className="w-px h-4 bg-slate-700" />}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <img src="/logo.svg" alt="Safety Trader" width={32} height={32} className="rounded-lg flex-shrink-0" />
        {title && sub ? (
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{title}</div>
            <div className="text-xs text-slate-400 truncate">{sub}</div>
          </div>
        ) : (
          <span className="font-semibold tracking-tight">
            {title || "Safety Trader"}{" "}
            <span className="text-slate-400 text-xs font-normal">D.Lgs. 81/2008</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {right}
        <div className="flex items-center gap-2 border-l border-slate-700 pl-3 ml-1">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{user.nome[0]}{user.cognome[0]}</div>
          <div className="hidden sm:block leading-tight"><div className="text-xs font-medium">{user.nome} {user.cognome}</div><div className="text-xs text-slate-400">{user.ruolo}</div></div>
        </div>
      </div>
    </header>
  );
}
