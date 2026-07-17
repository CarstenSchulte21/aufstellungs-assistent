"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type TeamOpt = { id: string; nummer: number; name: string };
export type SpielRow = {
  id: string;
  mannschaft_id: string;
  spieltag_nr: number;
  datum: string;
  uhrzeit: string;
  heim: boolean;
  gegner: string;
  ort: string;
  status: string;
};

export default function SpielplanClient({
  halbserieId,
  teams,
  rows,
}: {
  halbserieId: string;
  teams: TeamOpt[];
  rows: SpielRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [filter, setFilter] = useState<string>("");
  const [draft, setDraft] = useState<Record<string, SpielRow>>(
    Object.fromEntries(rows.map((r) => [r.id, { ...r }]))
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<string>("");

  const teamName = (id: string) =>
    teams.find((t) => t.id === id)?.name ?? "—";

  const sichtbar = useMemo(
    () => rows.filter((r) => !filter || r.mannschaft_id === filter),
    [rows, filter]
  );

  function upd(id: string, patch: Partial<SpielRow>) {
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function save(id: string) {
    const r = draft[id];
    const orig = rows.find((x) => x.id === id)!;
    setBusy(id);
    await supabase
      .from("spiele")
      .update({
        spieltag_nr: r.spieltag_nr,
        datum: r.datum,
        uhrzeit: r.uhrzeit || null,
        heim: r.heim,
        gegner: r.gegner,
        ort: r.ort || null,
      })
      .eq("id", id);

    if (r.datum !== orig.datum) {
      if (
        window.confirm(
          "Der Termin hat sich geändert. Betroffene Spieler neu abfragen? (setzt ihre Antworten für dieses Spiel zurück auf 'angefragt')"
        )
      ) {
        await supabase
          .from("verfuegbarkeiten")
          .update({ status: "angefragt" })
          .eq("spiel_id", id);
      }
    }
    setBusy(null);
    setInfo("Gespeichert ✓");
    router.refresh();
  }

  async function del(id: string) {
    if (!window.confirm("Dieses Spiel wirklich löschen?")) return;
    setBusy(id);
    await supabase.from("spiele").delete().eq("id", id);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          Mannschaft:
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="ml-2 rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">alle</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {info && <span className="text-[12px] text-emerald-600">{info}</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2">Mannschaft</th>
              <th className="px-2 py-2">Nr</th>
              <th className="px-2 py-2">Datum</th>
              <th className="px-2 py-2">Zeit</th>
              <th className="px-2 py-2">H/A</th>
              <th className="px-2 py-2">Gegner</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sichtbar.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-slate-400">
                  Keine Spiele. Lege unten welche an.
                </td>
              </tr>
            )}
            {sichtbar.map((r0) => {
              const r = draft[r0.id];
              return (
                <tr key={r0.id} className="border-b border-slate-50">
                  <td className="px-2 py-1.5 text-[12px] text-slate-500">
                    {teamName(r0.mannschaft_id)}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      value={r.spieltag_nr}
                      onChange={(e) =>
                        upd(r0.id, { spieltag_nr: Number(e.target.value) })
                      }
                      className="w-12 rounded border border-slate-300 px-1 py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="date"
                      value={r.datum}
                      onChange={(e) => upd(r0.id, { datum: e.target.value })}
                      className="rounded border border-slate-300 px-1 py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="time"
                      value={r.uhrzeit}
                      onChange={(e) => upd(r0.id, { uhrzeit: e.target.value })}
                      className="w-24 rounded border border-slate-300 px-1 py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => upd(r0.id, { heim: !r.heim })}
                      className={`rounded px-2 py-1 text-[12px] font-semibold ${
                        r.heim
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.heim ? "Heim" : "Ausw."}
                    </button>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={r.gegner}
                      onChange={(e) => upd(r0.id, { gegner: e.target.value })}
                      className="w-full min-w-[140px] rounded border border-slate-300 px-1 py-1"
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    <button
                      onClick={() => save(r0.id)}
                      disabled={busy === r0.id}
                      className="mr-2 rounded-lg bg-primary px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                    >
                      Speichern
                    </button>
                    <button
                      onClick={() => del(r0.id)}
                      disabled={busy === r0.id}
                      className="text-[12px] font-medium text-rose-600 hover:underline"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AddForms halbserieId={halbserieId} teams={teams} />
    </div>
  );
}

function AddForms({
  halbserieId,
  teams,
}: {
  halbserieId: string;
  teams: TeamOpt[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [team, setTeam] = useState(teams[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // Einzel
  const [nr, setNr] = useState(1);
  const [datum, setDatum] = useState("");
  const [uhrzeit, setUhrzeit] = useState("19:00");
  const [heim, setHeim] = useState(true);
  const [gegner, setGegner] = useState("");

  // Massenanlage
  const [anzahl, setAnzahl] = useState(8);
  const [startDatum, setStartDatum] = useState("");
  const [abstand, setAbstand] = useState(14);

  async function addEinzel(e: React.FormEvent) {
    e.preventDefault();
    if (!team || !datum || !gegner) return;
    setBusy(true);
    await supabase.from("spiele").insert({
      halbserie_id: halbserieId,
      mannschaft_id: team,
      spieltag_nr: nr,
      datum,
      uhrzeit: uhrzeit || null,
      heim,
      gegner,
      status: "geplant",
    });
    setBusy(false);
    setMsg("Spiel angelegt ✓");
    setGegner("");
    setNr((n) => n + 1);
    router.refresh();
  }

  async function addMasse(e: React.FormEvent) {
    e.preventDefault();
    if (!team || !startDatum || anzahl < 1) return;
    setBusy(true);
    const inserts = [];
    const start = new Date(startDatum + "T00:00:00Z");
    for (let i = 0; i < anzahl; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i * abstand);
      inserts.push({
        halbserie_id: halbserieId,
        mannschaft_id: team,
        spieltag_nr: i + 1,
        datum: d.toISOString().slice(0, 10),
        uhrzeit: "19:00",
        heim: i % 2 === 0,
        gegner: "noch offen",
        status: "geplant",
      });
    }
    await supabase.from("spiele").insert(inserts);
    setBusy(false);
    setMsg(`${anzahl} Spieltage angelegt ✓ — jetzt oben Gegner eintragen.`);
    router.refresh();
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <form
        onSubmit={addEinzel}
        className="rounded-xl border border-slate-200 bg-white p-4"
      >
        <h3 className="mb-3 text-[14px] font-bold text-slate-800">
          Einzelnes Spiel anlegen
        </h3>
        <div className="space-y-2 text-[13px]">
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              value={nr}
              onChange={(e) => setNr(Number(e.target.value))}
              placeholder="Nr"
              className="w-16 rounded-lg border border-slate-300 px-2 py-1.5"
            />
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              required
              className="rounded-lg border border-slate-300 px-2 py-1.5"
            />
            <input
              type="time"
              value={uhrzeit}
              onChange={(e) => setUhrzeit(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={heim}
              onChange={(e) => setHeim(e.target.checked)}
            />
            Heimspiel
          </label>
          <input
            type="text"
            value={gegner}
            onChange={(e) => setGegner(e.target.value)}
            placeholder="Gegner"
            required
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary px-3 py-1.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Anlegen
          </button>
        </div>
      </form>

      <form
        onSubmit={addMasse}
        className="rounded-xl border border-slate-200 bg-white p-4"
      >
        <h3 className="mb-3 text-[14px] font-bold text-slate-800">
          Mehrere Spieltage auf einmal
        </h3>
        <div className="space-y-2 text-[13px]">
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <label className="block">
            Anzahl Spieltage
            <input
              type="number"
              value={anzahl}
              onChange={(e) => setAnzahl(Number(e.target.value))}
              className="ml-2 w-16 rounded-lg border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label className="block">
            Erster Termin
            <input
              type="date"
              value={startDatum}
              onChange={(e) => setStartDatum(e.target.value)}
              required
              className="ml-2 rounded-lg border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label className="block">
            Abstand (Tage)
            <input
              type="number"
              value={abstand}
              onChange={(e) => setAbstand(Number(e.target.value))}
              className="ml-2 w-16 rounded-lg border border-slate-300 px-2 py-1.5"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary px-3 py-1.5 font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Spieltage anlegen
          </button>
          <p className="text-[11px] text-slate-400">
            Legt Platzhalter-Spiele (Gegner „noch offen“, H/A abwechselnd) an,
            die du oben feinjustierst.
          </p>
        </div>
      </form>
      {msg && (
        <p className="text-[12px] text-emerald-600 sm:col-span-2">{msg}</p>
      )}
    </div>
  );
}
