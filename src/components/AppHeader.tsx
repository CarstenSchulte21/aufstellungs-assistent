"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  userEmail: string;
  isAdmin?: boolean; // effektiv
  isMf?: boolean; // effektiv
  realIsAdmin?: boolean;
  realIsMf?: boolean;
  hatManagement?: boolean;
  modus?: "admin" | "mf" | "spieler";
  inboxCount?: number;
  spielerCount?: number;
};

export default function AppHeader({
  userEmail,
  isAdmin = false,
  isMf = false,
  realIsAdmin = false,
  realIsMf = false,
  hatManagement = false,
  modus = "spieler",
  inboxCount = 0,
  spielerCount = 0,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const bar =
    "rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-blue-50 transition hover:bg-white/20";
  const item = "block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100";
  const gruppe =
    "mt-1 px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400";

  const spielerModus = modus === "spieler";
  const modusLabel =
    modus === "admin"
      ? "Admin"
      : modus === "mf"
      ? "Mannschaftsführer"
      : "Spieler";

  function setModus(v: string) {
    document.cookie = `modus=${v}; path=/; max-age=2592000`;
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 bg-primary text-white shadow-md">
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
              {userEmail} · {modusLabel}
            </div>
          </div>
        </a>

        {hatManagement && (
          <label className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] text-blue-50">
            Modus:
            <select
              value={modus}
              onChange={(e) => setModus(e.target.value)}
              className="rounded bg-primary-dark px-1 py-0.5 text-[12px] text-white outline-none"
            >
              {realIsAdmin && <option value="admin">Admin</option>}
              {realIsMf && <option value="mf">Mannschaftsführer</option>}
              <option value="spieler">Spieler</option>
            </select>
          </label>
        )}

        {/* Schnellzugriff — Spieltagsplanung ist eine Spieler-Ansicht */}
        {(spielerModus || !hatManagement) && (
          <a href="/meine-spieltage" className={bar}>
            Spieltagsplanung
            {spielerCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-primary-dark">
                {spielerCount}
              </span>
            )}
          </a>
        )}

        <button onClick={() => setOpen((o) => !o)} className={bar}>
          Menü ▾
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-4 top-full z-30 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-xl">
            {isAdmin || isMf ? (
              <>
                <div className={gruppe}>Mannschaft</div>
                <a href="/kader" className={item}>
                  Kader
                </a>
                <a href="/regeln" className={item}>
                  Regeln
                </a>
                {isAdmin && (
                  <a href="/einsaetze" className={item}>
                    Einsätze
                  </a>
                )}
                <a href="/koppeln" className={item}>
                  Telegram-Kopplung
                </a>
                {isAdmin && (
                  <>
                    <div className={gruppe}>Verwaltung</div>
                    <a href="/admin" className={item}>
                      Verwaltung (Spielplan, Stammdaten, Führung)
                    </a>
                  </>
                )}
              </>
            ) : (
              <>
                <div className={gruppe}>Spieler</div>
                <a href="/meine-spieltage" className={item}>
                  Spieltagsplanung
                </a>
              </>
            )}

            <div className="my-1 border-t border-slate-100" />
            <a href="/konto" className={item}>
              Passwort ändern
            </a>
            <a href="/faq" className={item}>
              FAQ &amp; Funktionsübersicht
            </a>
            <a href="/info" className={item}>
              Info &amp; Hilfe
            </a>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className={`${item} w-full text-left font-medium text-rose-600`}
              >
                Abmelden
              </button>
            </form>
          </div>
        </>
      )}
    </header>
  );
}
