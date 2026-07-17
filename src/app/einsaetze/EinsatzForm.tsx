"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type Opt = { id: string; label: string };

export default function EinsatzForm({
  halbserieId,
  spieler,
  teams,
}: {
  halbserieId: string;
  spieler: Opt[];
  teams: Opt[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [spielerId, setSpielerId] = useState("");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [datum, setDatum] = useState("");
  const [ersatz, setErsatz] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!spielerId || !teamId || !datum) return;
    setBusy(true);
    setMsg("");
    const { error } = await supabase.from("einsaetze").insert({
      halbserie_id: halbserieId,
      spieler_id: spielerId,
      mannschaft_id: teamId,
      datum,
      ersatz,
      quelle: "admin",
    });
    setBusy(false);
    setMsg(error ? "Fehler: " + error.message : "Einsatz nachgetragen ✓");
    if (!error) {
      setSpielerId("");
      setDatum("");
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={add}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4"
    >
      <h3 className="w-full text-[14px] font-bold text-slate-800">
        Einsatz manuell nachtragen (Admin)
      </h3>
      <select
        value={spielerId}
        onChange={(e) => setSpielerId(e.target.value)}
        required
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">— Spieler —</option>
        {spieler.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <select
        value={teamId}
        onChange={(e) => setTeamId(e.target.value)}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={datum}
        onChange={(e) => setDatum(e.target.value)}
        required
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      />
      <label className="flex items-center gap-2 text-[13px] text-slate-600">
        <input
          type="checkbox"
          checked={ersatz}
          onChange={(e) => setErsatz(e.target.checked)}
        />
        Ersatzeinsatz
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
      >
        Nachtragen
      </button>
      {msg && <span className="text-[12px] text-slate-600">{msg}</span>}
    </form>
  );
}
