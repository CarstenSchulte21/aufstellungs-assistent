"use client";

type Props = {
  userEmail: string;
  rollen: string[];
  isMf?: boolean;
  inboxCount?: number;
};

function rollenLabel(rollen: string[]) {
  if (rollen.includes("admin")) return "Admin";
  if (rollen.includes("mannschaftsfuehrer")) return "Mannschaftsführer";
  return "Spieler";
}

export default function AppHeader({
  userEmail,
  rollen,
  isMf = false,
  inboxCount = 0,
}: Props) {
  const istAdmin = rollen.includes("admin");
  const linkCls =
    "rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-blue-50 transition hover:bg-white/20";

  return (
    <header className="bg-primary text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
        <a href="/" className="mr-auto flex items-center gap-3" title="Zur Übersicht">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-lg">
            🏓
          </div>
          <div>
            <div className="text-[15px] font-bold leading-tight">
              Aufstellungs-Assistent
            </div>
            <div className="text-[11px] text-blue-200">
              {userEmail} · {rollenLabel(rollen)}
            </div>
          </div>
        </a>

        <a href="/matrix" className={linkCls}>
          Saison-Matrix
        </a>
        <a href="/meine-spieltage" className={linkCls}>
          Meine Spieltage
        </a>
        {isMf && (
          <a href="/mannschaft" className={linkCls}>
            Meine Mannschaft
          </a>
        )}
        {(istAdmin || isMf) && (
          <>
            <a href="/inbox" className={`${linkCls} relative`}>
              Inbox
              {inboxCount > 0 && (
                <span className="ml-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-primary-dark">
                  {inboxCount}
                </span>
              )}
            </a>
            <a href="/kader" className={linkCls}>
              Kader
            </a>
            <a href="/regeln" className={linkCls}>
              Regeln
            </a>
            <a href="/einsaetze" className={linkCls}>
              Einsätze
            </a>
          </>
        )}
        {istAdmin && (
          <a href="/admin" className={linkCls}>
            Verwaltung
          </a>
        )}
        <form action="/auth/signout" method="post">
          <button type="submit" className={linkCls}>
            Abmelden
          </button>
        </form>
      </div>
    </header>
  );
}
