"use client";

import { useRef, useState } from "react";
import type { TeamUebersicht } from "@/lib/lagebild";

function fmt(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export default function UebersichtTeams({
  teams,
}: {
  teams: TeamUebersicht[];
}) {
  const [offset, setOffset] = useState(0);
  const maxLen = teams.reduce((m, t) => Math.max(m, t.naechste.length), 0);
  const maxOffset = Math.max(0, maxLen - 1);
  const label =
    offset === 0 ? "Nächster Spieltag" : `${offset + 1}. Spieltag ab heute`;

  const go = (dir: 1 | -1) =>
    setOffset((o) => Math.min(maxOffset, Math.max(0, o + dir)));

  // Wischgesten (Touch): nach links = weiter, nach rechts = zurück
  const touch = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.changedTouches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-[15px] font-bold text-slate-800">
          Spieltagsübersicht
        </h1>
        {maxLen > 1 && (
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => go(-1)}
              disabled={offset === 0}
              aria-label="Vorheriger Spieltag"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-600 hover:border-slate-400 disabled:opacity-40"
            >
              ‹
            </button>
            <span className="min-w-[150px] text-center text-[12px] font-medium text-slate-500">
              {label}
            </span>
            <button
              onClick={() => go(1)}
              disabled={offset >= maxOffset}
              aria-label="Nächster Spieltag"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-600 hover:border-slate-400 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Noch keine Mannschaften angelegt.
        </div>
      ) : (
        <div
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {teams.map((t) => {
            const n = t.naechste[offset] ?? null;
            const fehlt = n ? Math.max(0, t.benoetigt - n.zu) : 0;
            return (
              <div
                key={t.teamId}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <a
                    href={`/matrix?team=${t.teamId}`}
                    className="font-bold text-slate-900 hover:text-primary"
                  >
                    {t.name}
                  </a>
                  <span className="text-[11px] text-slate-400">
                    braucht {t.benoetigt}
                  </span>
                </div>
                {n ? (
                  <a
                    href={`/spieltag/${n.spielId}`}
                    className="mt-2 block rounded-lg border border-slate-100 p-2 hover:border-primary"
                  >
                    <div className="text-[13px] font-medium text-slate-700">
                      {fmt(n.datum)} · {n.heim ? "Heim" : "Auswärts"} gegen{" "}
                      {n.gegner}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[12px]">
                      <span
                        className={`rounded px-1.5 py-0.5 font-bold ${
                          fehlt
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {n.zu}/{t.benoetigt} {fehlt ? "⚠" : "✓"}
                      </span>
                      <span className="text-rose-500">✕ {n.abgesagt}</span>
                    </div>
                  </a>
                ) : (
                  <div className="mt-2 text-[12px] text-slate-400">
                    {offset === 0
                      ? "Kein anstehendes Spiel."
                      : "Kein weiteres Spiel."}
                  </div>
                )}
                {(t.mf || t.stellv) && (
                  <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                    {t.mf && (
                      <div>
                        <span className="text-slate-400">MF:</span>{" "}
                        <span className="font-medium text-slate-600">
                          {t.mf.name}
                        </span>
                        {t.mf.telefon && (
                          <a
                            href={`tel:${t.mf.telefon}`}
                            className="ml-1 text-primary hover:underline"
                          >
                            {t.mf.telefon}
                          </a>
                        )}
                      </div>
                    )}
                    {t.stellv && (
                      <div>
                        <span className="text-slate-400">Stellv.:</span>{" "}
                        <span className="font-medium text-slate-600">
                          {t.stellv.name}
                        </span>
                        {t.stellv.telefon && (
                          <a
                            href={`tel:${t.stellv.telefon}`}
                            className="ml-1 text-primary hover:underline"
                          >
                            {t.stellv.telefon}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
