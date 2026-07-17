"use client";

import { useState } from "react";

export type KoppelSpieler = {
  id: string;
  name: string;
  teamNummer: number;
  teamName: string;
  gekoppelt: boolean;
};

export default function KoppelnClient({
  spieler,
}: {
  spieler: KoppelSpieler[];
}) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<Record<string, string>>({});

  async function linkErzeugen(id: string) {
    setBusy(id + ":link");
    setMeldung((m) => ({ ...m, [id]: "" }));
    const res = await fetch("/api/telegram/koppeln", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spieler_id: id }),
    });
    const json = await res.json();
    setBusy(null);
    if (res.ok) setLinks((l) => ({ ...l, [id]: json.link }));
    else setMeldung((m) => ({ ...m, [id]: json.error || "Fehler" }));
  }

  async function testabfrage(id: string) {
    setBusy(id + ":abfrage");
    setMeldung((m) => ({ ...m, [id]: "" }));
    const res = await fetch("/api/telegram/abfrage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spieler_id: id }),
    });
    const json = await res.json();
    setBusy(null);
    setMeldung((m) => ({
      ...m,
      [id]: res.ok ? "Abfrage gesendet ✓" : json.error || "Fehler",
    }));
  }

  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {spieler.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-auto min-w-[160px]">
            <div className="font-medium text-slate-900">
              {s.name}
              {s.gekoppelt && (
                <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  verbunden
                </span>
              )}
            </div>
            <div className="text-[12px] text-slate-500">{s.teamName}</div>
            {links[s.id] && (
              <a
                href={links[s.id]}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-[12px] font-medium text-primary hover:underline"
              >
                {links[s.id]}
              </a>
            )}
            {meldung[s.id] && (
              <div className="mt-1 text-[12px] text-slate-600">{meldung[s.id]}</div>
            )}
          </div>
          <button
            onClick={() => linkErzeugen(s.id)}
            disabled={busy === s.id + ":link"}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 disabled:opacity-50"
          >
            {busy === s.id + ":link" ? "…" : "Link erzeugen"}
          </button>
          <button
            onClick={() => testabfrage(s.id)}
            disabled={!s.gekoppelt || busy === s.id + ":abfrage"}
            title={s.gekoppelt ? "" : "Erst verbinden"}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-40"
          >
            {busy === s.id + ":abfrage" ? "…" : "Testabfrage"}
          </button>
        </div>
      ))}
    </div>
  );
}
