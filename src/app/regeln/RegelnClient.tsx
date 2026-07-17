"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Kandidat } from "@/lib/engine/kandidaten";

export type TeamOpt = { id: string; nummer: number; name: string };
export type SpielOpt = { id: string; label: string };
export type SpielerOpt = { id: string; name: string; team: number };

export default function RegelnClient({
  halbserieId,
  teamId,
  config,
  spiele,
  spieler,
}: {
  halbserieId: string;
  teamId: string;
  config: Record<string, any>;
  spiele: SpielOpt[];
  spieler: SpielerOpt[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [sortierung, setSortierung] = useState<string>(
    config.kaskade_sortierung ?? "position"
  );
  const [tabu, setTabu] = useState<string[]>(config.tabu_spieler ?? []);
  const [vorlauf, setVorlauf] = useState<number>(
    config.vorlauf_erstabfrage_tage ?? 28
  );
  const [reminderStd, setReminderStd] = useState<number>(
    config.reminder_nach_stunden ?? 48
  );
  const [maxReminder, setMaxReminder] = useState<number>(config.max_reminder ?? 2);
  const [frist, setFrist] = useState<number>(
    config.ersatz_antwortfrist_stunden ?? 48
  );

  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [spielId, setSpielId] = useState<string>(spiele[0]?.id ?? "");
  const [vorschau, setVorschau] = useState<Kandidat[] | null>(null);
  const [vorschauBusy, setVorschauBusy] = useState(false);

  function toggleTabu(id: string) {
    setTabu((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  }

  async function speichern() {
    setBusy(true);
    setMsg("");
    const neu = {
      ...config,
      kaskade_sortierung: sortierung,
      tabu_spieler: tabu,
      vorlauf_erstabfrage_tage: vorlauf,
      reminder_nach_stunden: reminderStd,
      max_reminder: maxReminder,
      ersatz_antwortfrist_stunden: frist,
    };
    const { error } = await supabase
      .from("regel_config")
      .upsert(
        { mannschaft_id: teamId, halbserie_id: halbserieId, config: neu },
        { onConflict: "mannschaft_id,halbserie_id" }
      );
    setBusy(false);
    setMsg(error ? "Fehler: " + error.message : "Gespeichert ✓");
    router.refresh();
  }

  async function ladeVorschau() {
    if (!spielId) return;
    setVorschauBusy(true);
    const res = await fetch("/api/ersatz/vorschau", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spiel_id: spielId }),
    });
    const json = await res.json();
    setVorschauBusy(false);
    setVorschau(json.kandidaten ?? []);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-[15px] font-bold text-slate-800">
          Regelkonfiguration
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-[13px] text-slate-600">
            Sortierung der Kandidaten
            <select
              value={sortierung}
              onChange={(e) => setSortierung(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="position">nach Position (Meldung)</option>
              <option value="qttr">nach QTTR (absteigend)</option>
            </select>
            <span className="mt-1 block text-[11px] text-slate-400">
              Kaskade: immer nächstniedrigere Mannschaft zuerst.
            </span>
          </label>

          <div className="grid grid-cols-2 gap-2 text-[13px] text-slate-600">
            <label>
              Vorlauf Erstabfrage (Tage)
              <input
                type="number"
                value={vorlauf}
                onChange={(e) => setVorlauf(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
              />
            </label>
            <label>
              Reminder nach (Std.)
              <input
                type="number"
                value={reminderStd}
                onChange={(e) => setReminderStd(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
              />
            </label>
            <label>
              Max. Reminder
              <input
                type="number"
                value={maxReminder}
                onChange={(e) => setMaxReminder(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
              />
            </label>
            <label>
              Ersatz-Antwortfrist (Std.)
              <input
                type="number"
                value={frist}
                onChange={(e) => setFrist(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
              />
            </label>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 text-[13px] font-medium text-slate-600">
            Tabu-Spieler (werden nie als Ersatz vorgeschlagen)
          </div>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2">
            <div className="grid gap-1 sm:grid-cols-2">
              {spieler.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={tabu.includes(s.id)}
                    onChange={() => toggleTabu(s.id)}
                  />
                  {s.name}{" "}
                  <span className="text-slate-400">· {s.team}. M.</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={speichern}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Speichern
          </button>
          {msg && <span className="text-[12px] text-slate-600">{msg}</span>}
        </div>
      </div>

      {/* Live-Vorschau */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-[15px] font-bold text-slate-800">
          Vorschau: Kandidaten für einen Spieltag
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={spielId}
            onChange={(e) => setSpielId(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            {spiele.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={ladeVorschau}
            disabled={vorschauBusy || !spielId}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 disabled:opacity-50"
          >
            {vorschauBusy ? "…" : "Vorschau laden"}
          </button>
          <span className="text-[11px] text-slate-400">
            (nach zuletzt gespeicherter Konfiguration)
          </span>
        </div>

        {vorschau && (
          <div className="mt-3 space-y-1.5">
            {vorschau.length === 0 && (
              <p className="text-sm text-slate-500">Keine Kandidaten.</p>
            )}
            {vorschau.map((c, i) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-[13px]"
              >
                <span className="font-bold text-slate-400">{i + 1}.</span>
                <span className="font-medium text-slate-800">{c.name}</span>
                <span className="text-slate-500">
                  {c.teamNummer}. M. · Pos {c.position} · QTTR {c.qttr}
                </span>
                {c.locked && <span className="text-slate-400">🔒</span>}
                {c.warnungen.map((w) => (
                  <span key={w} className="text-amber-600">
                    ⚠ {w}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
