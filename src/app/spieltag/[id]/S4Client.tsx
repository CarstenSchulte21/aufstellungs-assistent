"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type S4Player = {
  id: string;
  name: string;
  position: number;
  kaderStatus: string;
  status: string;
  kommentar: string | null;
};

type Spiel = {
  id: string;
  spieltag_nr: number;
  datum: string;
  heim: boolean;
  gegner: string;
  teamName: string;
  need: number;
};

function fmt(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const GROUPS: { key: string; label: string; match: (s: string) => boolean; tone: string }[] = [
  { key: "zu", label: "Zugesagt", match: (s) => s === "zugesagt", tone: "text-emerald-700 bg-emerald-50" },
  { key: "offen", label: "Angefragt / offen", match: (s) => ["angefragt", "erinnert", "unsicher"].includes(s), tone: "text-amber-700 bg-amber-50" },
  { key: "ab", label: "Abgesagt", match: (s) => ["abgesagt", "extern_verplant"].includes(s), tone: "text-rose-600 bg-rose-50" },
  { key: "stumm", label: "Keine Antwort / nicht aktiv", match: (s) => ["keine_antwort", "nicht_angefragt", "pausiert", "inaktiv"].includes(s), tone: "text-slate-500 bg-slate-50" },
];

export default function S4Client({
  spiel,
  zu,
  players,
  istMf,
  parallelTeams,
}: {
  spiel: Spiel;
  zu: number;
  players: S4Player[];
  istMf: boolean;
  parallelTeams: string[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<Record<string, string>>({});
  const fehlt = Math.max(0, spiel.need - zu);

  async function setStatus(spielerId: string, status: string) {
    setBusy(spielerId);
    await supabase.from("verfuegbarkeiten").upsert(
      { spiel_id: spiel.id, spieler_id: spielerId, status, quelle: "admin" },
      { onConflict: "spiel_id,spieler_id" }
    );
    setBusy(null);
    router.refresh();
  }

  async function erneutAnfragen(spielerId: string) {
    setBusy(spielerId + ":req");
    const res = await fetch("/api/telegram/abfrage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spieler_id: spielerId, spiel_id: spiel.id }),
    });
    const json = await res.json();
    setBusy(null);
    setInfo((i) => ({
      ...i,
      [spielerId]: res.ok ? "Abfrage gesendet ✓" : json.error || "Fehler",
    }));
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <a href="/" className="text-blue-100 hover:text-white">
            ←
          </a>
          <div className="mr-auto text-[15px] font-bold">Spieltag-Detail</div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Spieltag {spiel.spieltag_nr} · {spiel.heim ? "Heim" : "Auswärts"}{" "}
                gegen {spiel.gegner}
              </h2>
              <p className="text-sm text-slate-500">
                {fmt(spiel.datum)} · {spiel.teamName} · benötigt {spiel.need}{" "}
                Spieler
              </p>
            </div>
            <div
              className={`rounded-lg px-3 py-2 text-center ${
                fehlt ? "bg-amber-50" : "bg-emerald-50"
              }`}
            >
              <div
                className={`text-xl font-black ${
                  fehlt ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {zu}/{spiel.need}
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                {fehlt ? `${fehlt} fehlt` : "vollständig"}
              </div>
            </div>
          </div>

          {parallelTeams.length > 0 && (
            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] text-blue-800">
              ℹ Parallelspieltag: Am selben Tag spielen auch {parallelTeams.join(", ")}.
            </div>
          )}
        </div>

        {/* Statusgruppen */}
        <div className="grid gap-3 sm:grid-cols-2">
          {GROUPS.map((g) => {
            const list = players.filter((p) => g.match(p.status));
            return (
              <div
                key={g.key}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="mb-2 text-[12px] font-bold text-slate-600">
                  {g.label}{" "}
                  <span className="text-slate-400">({list.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {list.length === 0 && (
                    <span className="text-[12px] text-slate-400">—</span>
                  )}
                  {list.map((p) => (
                    <span
                      key={p.id}
                      title={p.kommentar ?? ""}
                      className={`rounded px-1.5 py-0.5 text-[12px] font-medium ${g.tone}`}
                    >
                      {p.name}
                      {p.kommentar ? " 💬" : ""}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* MF-Aktionen */}
        {istMf && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-[15px] font-bold text-slate-800">
              Manuell steuern
            </h3>
            <p className="mb-3 text-[12px] text-slate-500">
              Status setzen (Quelle: Admin) oder einzelne Spieler erneut per
              Telegram anfragen.
            </p>
            <div className="divide-y divide-slate-100">
              {players.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center gap-2 py-2"
                >
                  <span className="mr-auto min-w-[130px] text-sm text-slate-800">
                    <span className="mr-2 text-[11px] font-bold text-slate-300">
                      {p.position}
                    </span>
                    {p.name}
                  </span>
                  <select
                    defaultValue=""
                    disabled={busy === p.id}
                    onChange={(e) => e.target.value && setStatus(p.id, e.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-[13px]"
                  >
                    <option value="">Status setzen…</option>
                    <option value="zugesagt">Zugesagt</option>
                    <option value="abgesagt">Abgesagt</option>
                    <option value="unsicher">Unsicher</option>
                    <option value="angefragt">Angefragt</option>
                  </select>
                  <button
                    onClick={() => erneutAnfragen(p.id)}
                    disabled={busy === p.id + ":req"}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[13px] font-medium text-slate-700 hover:border-slate-400"
                  >
                    {busy === p.id + ":req" ? "…" : "Erneut anfragen"}
                  </button>
                  {info[p.id] && (
                    <span className="text-[12px] text-slate-500">
                      {info[p.id]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ersatz-Platzhalter */}
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-[13px] text-slate-400">
          Ersatzvorschläge bei Lücken — verfügbar ab Phase 2 (Meilenstein 5).
        </div>
      </main>
    </div>
  );
}
