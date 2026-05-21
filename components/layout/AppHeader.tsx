// @ts-nocheck
export function AppHeader({ left, right, title, sub, user }) {
  return (
    <header className="border-b border-slate-800/60 bg-slate-900 text-white shadow-md">
      <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-5 py-3.5 sm:px-6">
        {left}
        {left && <div className="h-5 w-px bg-slate-700" />}

        <div className="flex min-w-0 flex-1 items-center gap-3">
          {title && sub ? (
            <>
              <img
                src="/logo.svg"
                alt="Safety Trader"
                width={32}
                height={32}
                className="flex-shrink-0 rounded-lg"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{title}</div>
                <div className="truncate text-xs text-slate-400">{sub}</div>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white text-sm font-black tracking-tight text-slate-900 shadow-sm">
                ST
              </div>
              <div className="min-w-0 leading-tight">
                <div className="text-sm font-bold tracking-tight">Safety Trader</div>
                <div className="text-xs font-medium text-blue-200">D.Lgs. 81/2008</div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {right}
          <div className="ml-1 flex items-center gap-2 border-l border-slate-700 pl-3 sm:pl-4">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">
              {user.nome[0]}
              {user.cognome[0]}
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="text-xs font-medium">
                {user.nome} {user.cognome}
              </div>
              <div className="text-xs text-slate-400">{user.ruolo}</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
