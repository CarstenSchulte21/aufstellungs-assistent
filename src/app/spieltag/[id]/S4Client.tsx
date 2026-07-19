"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Kandidat } from "@/lib/engine/kandidaten";
import SpielAendern, { type BearbeitenData } from "./SpielAendern";

export type S4Player = {
  id: string;
  name: string;
  position: number;
  kaderStatus: string;
  status: string;
  kommentar: string | null;
  ersatzHerkunft?: number | null;
  favorit?: boolean;
};

export type ErsatzAnfrage = {
  id: string;
  spieler_id: string;
  name: string;
  status: string;
  frist_bis: string | null;
};

type Spiel = {
  id: string;
  spieltag_nr: number;
  datum: string;
  uhrzeit?: string | null;
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
  kandidaten = [],
  anfragen = [],
  bearbeiten,
}: {
  spiel: Spiel;
  zu: number;
  players: S4Player[];
  istMf: boolean;
  parallelTeams: string[];
  kandidaten?: Kandidat[];
  anfragen?: ErsatzAnfrage[];
  bearbeiten?: BearbeitenData;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<Record<string, string>>({});
  const [ersatzInfo, setErsatzInfo] = useState<string>("");
  const fehlt = Math.max(0, spiel.need - zu);

  // spieler_ids, die bereits eine laufende/erledigte Anfrage haben
  const schonAngefragt = new Set(anfragen.map((a) => a.spieler_id));

  async function freigeben(spielerId: string) {
    setBusy("frei:" + spielerId);
    setErsatzInfo("");
    const res = await fetch("/api/ersatz/freigeben", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spiel_id: spiel.id, spieler_id: spielerId }),
    });
    const json = await res.json();
    setBusy(null);
    setErsatzInfo(res.ok ? json.hinweis ?? "Anfrage gesendet ✓" : json.error || "Fehler");
    router.refresh();
  }

  async function einplanen(anfrageId: string) {
    setBusy("plan:" + anfrageId);
    const res = await fetch("/api/ersatz/einplanen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ersatzanfrage_id: anfrageId }),
    });
    const json = await res.json();
    setBusy(null);
    setErsatzInfo(res.ok ? "Eingeplant ✓" : json.error || "Fehler");
    router.refresh();
  }

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
                {fmt(spiel.datum)}
                {spiel.uhrzeit ? ` · ${spiel.uhrzeit.slice(0, 5)} Uhr` : ""} ·{" "}
                {spiel.teamName} · benötigt {spiel.need} Spieler
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
                      {p.favorit
                        ? " (Favorit)"
                        : p.ersatzHerkunft
                        ? ` (Ersatz ${p.ersatzHerkunft}.M.)`
                        : ""}
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
                      {p.favorit || p.ersatzHerkunft ? "" : p.position}
                    </span>
                    {p.name}
                    {p.favorit && (
                      <span className="ml-2 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                        Favorit
                      </span>
                    )}
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

        {/* Spiel bearbeiten (Verlegung / Heimrecht / Absetzen) */}
        {istMf && bearbeiten && (
          <SpielAendern spielId={spiel.id} data={bearbeiten} />
        )}

        {/* Ersatzvorschläge (S8) */}
        {istMf && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-[15px] font-bold text-slate-800">
              Ersatzvorschläge{" "}
              {fehlt > 0 ? (
                <span className="text-amber-600">
                  ({fehlt} Lücke{fehlt > 1 ? "n" : ""})
                </span>
              ) : (
                <span className="text-slate-400">(Vorschau)</span>
              )}
            </h3>
            <p className="mb-3 mt-0.5 text-[12px] text-slate-500">
              Regelkonform ermittelt (nur von unten, kein Sperrvermerk, nicht am
              selben Tag verplant). Die Anfrage geht erst nach deiner Freigabe per
              Telegram raus.
            </p>

            {/* Laufende Anfragen */}
            {anfragen.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {anfragen.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px]"
                  >
                    <span className="font-medium text-slate-800">{a.name}</span>
                    <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                      {a.status}
                    </span>
                    {a.status === "zugesagt" && (
                      <button
                        onClick={() => einplanen(a.id)}
                        disabled={busy === "plan:" + a.id}
                        className="ml-auto rounded-lg bg-emerald-600 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Fest einplanen
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Kandidatenliste */}
            {kandidaten.length === 0 ? (
              <p className="text-sm text-slate-500">
                Keine zulässigen Ersatzkandidaten gefunden.
              </p>
            ) : (
              <div className="space-y-2">
                {kandidaten.map((c, i) => {
                  const asked = schonAngefragt.has(c.id);
                  const sperr = c.locked || asked;
                  return (
                    <div
                      key={c.id}
                      className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
                        sperr ? "border-slate-100 bg-slate-50 opacity-80" : "border-slate-200"
                      }`}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[12px] font-bold text-slate-500">
                        {i + 1}
                      </span>
                      <div className="mr-auto min-w-[180px]">
                        <div className="font-semibold text-slate-900">{c.name}</div>
                        <div className="text-[12px] text-slate-500">
                          {c.teamNummer}. Mannschaft · Pos. {c.position} · QTTR{" "}
                          {c.qttr} · {c.einsaetze} Ersatzeinsätze
                        </div>
                        {c.warnungen.map((w) => (
                          <div key={w} className="mt-0.5 text-[12px] font-medium text-amber-600">
                            ⚠ {w}
                          </div>
                        ))}
                        {c.locked && !asked && (
                          <div className="mt-0.5 text-[12px] font-medium text-slate-500">
                            🔒 Aktuell nicht anfragbar (bereits von einer anderen
                            Mannschaft angefragt oder für diesen Tag zugesagt)
                          </div>
                        )}
                      </div>
                      {asked ? (
                        <span className="rounded bg-amber-50 px-2 py-1 text-[12px] font-semibold text-amber-700">
                          angefragt
                        </span>
                      ) : (
                        <button
                          disabled={c.locked || busy === "frei:" + c.id}
                          onClick={() => freigeben(c.id)}
                          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                            c.locked
                              ? "cursor-not-allowed bg-slate-100 text-slate-400"
                              : "bg-primary text-white hover:bg-primary-dark"
                          }`}
                        >
                          {busy === "frei:" + c.id ? "…" : "Anfrage stellen"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {ersatzInfo && (
              <p className="mt-3 text-[12px] text-slate-600">{ersatzInfo}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
