"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type TeamOpt = { id: string; nummer: number; name: string; spielstaerke: number };
export type SpielerRow = {
  id: string;
  name: string;
  qttr: number;
  telefon: string;
  email: string;
  kanal: string;
  dsgvo: boolean;
};
export type MeldungRow = {
  id: string;
  mannschaft_id: string;
  spieler_id: string;
  position: number;
  sperrvermerk: boolean;
  res: boolean;
};

export default function StammdatenClient({
  halbserieId,
  spieler,
  teams,
  meldungen,
}: {
  halbserieId: string;
  spieler: SpielerRow[];
  teams: TeamOpt[];
  meldungen: MeldungRow[];
}) {
  const [tab, setTab] = useState<"spieler" | "meldung">("spieler");
  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
        <button
          onClick={() => setTab("spieler")}
          className={`rounded-md px-4 py-1.5 ${
            tab === "spieler" ? "bg-white text-primary shadow-sm" : "text-slate-500"
          }`}
        >
          Spielerstamm
        </button>
        <button
          onClick={() => setTab("meldung")}
          className={`rounded-md px-4 py-1.5 ${
            tab === "meldung" ? "bg-white text-primary shadow-sm" : "text-slate-500"
          }`}
        >
          Mannschaftsmeldung
        </button>
      </div>
      {tab === "spieler" ? (
        <SpielerTab spieler={spieler} />
      ) : (
        <MeldungTab
          halbserieId={halbserieId}
          spieler={spieler}
          teams={teams}
          meldungen={meldungen}
        />
      )}
    </div>
  );
}

function SpielerTab({ spieler }: { spieler: SpielerRow[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState<Record<string, SpielerRow>>(
    Object.fromEntries(spieler.map((s) => [s.id, { ...s }]))
  );
  const [busy, setBusy] = useState<string | null>(null);

  // Neuer Spieler
  const [name, setName] = useState("");
  const [qttr, setQttr] = useState(1000);
  const [email, setEmail] = useState("");

  const list = useMemo(
    () =>
      spieler.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())),
    [spieler, q]
  );

  function upd(id: string, patch: Partial<SpielerRow>) {
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function save(id: string) {
    const r = draft[id];
    setBusy(id);
    await supabase
      .from("spieler")
      .update({
        name: r.name,
        qttr: r.qttr,
        telefon: r.telefon || null,
        email: r.email || null,
      })
      .eq("id", id);
    setBusy(null);
    router.refresh();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    setBusy("new");
    await supabase.from("spieler").insert({
      name,
      qttr,
      email: email || null,
      kanal: "telegram",
      praeferenzen: {},
    });
    setName("");
    setQttr(1000);
    setEmail("");
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Spieler suchen…"
        className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">QTTR</th>
              <th className="px-2 py-2">Telefon</th>
              <th className="px-2 py-2">E-Mail</th>
              <th className="px-2 py-2">DSGVO</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((s0) => {
              const r = draft[s0.id];
              return (
                <tr key={s0.id} className="border-b border-slate-50">
                  <td className="px-2 py-1.5">
                    <input
                      value={r.name}
                      onChange={(e) => upd(s0.id, { name: e.target.value })}
                      className="w-full min-w-[130px] rounded border border-slate-300 px-1 py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      value={r.qttr}
                      onChange={(e) => upd(s0.id, { qttr: Number(e.target.value) })}
                      className="w-16 rounded border border-slate-300 px-1 py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={r.telefon}
                      onChange={(e) => upd(s0.id, { telefon: e.target.value })}
                      className="w-28 rounded border border-slate-300 px-1 py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={r.email}
                      onChange={(e) => upd(s0.id, { email: e.target.value })}
                      className="w-40 rounded border border-slate-300 px-1 py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    {s0.dsgvo ? (
                      <span className="text-emerald-600">✓</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      onClick={() => save(s0.id)}
                      disabled={busy === s0.id}
                      className="rounded-lg bg-primary px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                    >
                      Speichern
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={add}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4"
      >
        <h3 className="w-full text-[14px] font-bold text-slate-800">
          Neuen Spieler anlegen
        </h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          required
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          value={qttr}
          onChange={(e) => setQttr(Number(e.target.value))}
          placeholder="QTTR"
          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail (für Login)"
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={busy === "new"}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          Anlegen
        </button>
      </form>
    </div>
  );
}

function MeldungTab({
  halbserieId,
  spieler,
  teams,
  meldungen,
}: {
  halbserieId: string;
  spieler: SpielerRow[];
  teams: TeamOpt[];
  meldungen: MeldungRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [neuSpieler, setNeuSpieler] = useState("");

  const nameOf = (id: string) => spieler.find((s) => s.id === id)?.name ?? "—";
  const team = teams.find((t) => t.id === teamId);
  const teamMeld = meldungen
    .filter((m) => m.mannschaft_id === teamId)
    .sort((a, b) => a.position - b.position);
  const meldedIds = new Set(meldungen.map((m) => m.spieler_id));
  const verfuegbar = spieler.filter((s) => !meldedIds.has(s.id));

  async function addMeldung(e: React.FormEvent) {
    e.preventDefault();
    if (!neuSpieler || !teamId) return;
    setBusy(true);
    const pos = (teamMeld.at(-1)?.position ?? 0) + 1;
    await supabase.from("meldungen").insert({
      halbserie_id: halbserieId,
      mannschaft_id: teamId,
      spieler_id: neuSpieler,
      position: pos,
      sperrvermerk: false,
      res: pos > (team?.spielstaerke ?? 0),
    });
    // Operativen Kader-Status anlegen (aktiv), falls noch nicht vorhanden
    await supabase
      .from("kader_status")
      .upsert(
        { halbserie_id: halbserieId, spieler_id: neuSpieler, status: "aktiv" },
        { onConflict: "halbserie_id,spieler_id", ignoreDuplicates: true }
      );
    setNeuSpieler("");
    setBusy(false);
    router.refresh();
  }

  async function toggle(m: MeldungRow, field: "sperrvermerk" | "res") {
    await supabase
      .from("meldungen")
      .update({ [field]: !m[field] })
      .eq("id", m.id);
    router.refresh();
  }

  async function setPos(m: MeldungRow, pos: number) {
    await supabase.from("meldungen").update({ position: pos }).eq("id", m.id);
    router.refresh();
  }

  async function remove(m: MeldungRow) {
    if (!window.confirm(`${nameOf(m.spieler_id)} aus der Meldung entfernen?`))
      return;
    await supabase.from("meldungen").delete().eq("id", m.id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {teams.map((t) => (
          <button
            key={t.id}
            onClick={() => setTeamId(t.id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              t.id === teamId
                ? "border-primary bg-primary text-white"
                : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <p className="text-[12px] text-slate-500">
        {team?.name} · benötigt {team?.spielstaerke} Spieler · {teamMeld.length}{" "}
        gemeldet
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2">Pos</th>
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Sperrvermerk</th>
              <th className="px-2 py-2">RES</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {teamMeld.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-6 text-center text-slate-400">
                  Noch keine Spieler gemeldet.
                </td>
              </tr>
            )}
            {teamMeld.map((m) => (
              <tr key={m.id} className="border-b border-slate-50">
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    defaultValue={m.position}
                    onBlur={(e) => setPos(m, Number(e.target.value))}
                    className="w-12 rounded border border-slate-300 px-1 py-1"
                  />
                </td>
                <td className="px-2 py-1.5 font-medium text-slate-800">
                  {nameOf(m.spieler_id)}
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={m.sperrvermerk}
                    onChange={() => toggle(m, "sperrvermerk")}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={m.res}
                    onChange={() => toggle(m, "res")}
                  />
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    onClick={() => remove(m)}
                    className="text-[12px] font-medium text-rose-600 hover:underline"
                  >
                    Entfernen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={addMeldung}
        className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4"
      >
        <h3 className="w-full text-[14px] font-bold text-slate-800">
          Spieler zur Meldung hinzufügen
        </h3>
        <select
          value={neuSpieler}
          onChange={(e) => setNeuSpieler(e.target.value)}
          required
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="">— Spieler wählen —</option>
          {verfuegbar.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} (QTTR {s.qttr})
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy || !neuSpieler}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
        >
          Hinzufügen
        </button>
        <p className="w-full text-[11px] text-slate-400">
          Nur Spieler, die noch in keiner Mannschaft dieser Halbserie gemeldet
          sind. Position und RES werden automatisch vorbelegt und können oben
          angepasst werden.
        </p>
      </form>
    </div>
  );
}
