"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type Kandidat = { id: string; name: string };
export type TeamFuehrung = {
  id: string;
  nummer: number;
  name: string;
  mf_id: string | null;
  stellv_id: string | null;
  kader: Kandidat[];
};

export default function FuehrungClient({ teams }: { teams: TeamFuehrung[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [state, setState] = useState<
    Record<string, { mf: string; stellv: string }>
  >(
    Object.fromEntries(
      teams.map((t) => [
        t.id,
        { mf: t.mf_id ?? "", stellv: t.stellv_id ?? "" },
      ])
    )
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<Record<string, string>>({});

  async function save(t: TeamFuehrung) {
    setBusy(t.id);
    setInfo((i) => ({ ...i, [t.id]: "" }));
    const s = state[t.id];
    const { error } = await supabase.rpc("set_team_mf", {
      p_mannschaft: t.id,
      p_mf: s.mf || null,
      p_stellv: s.stellv || null,
    });
    setBusy(null);
    setInfo((i) => ({
      ...i,
      [t.id]: error ? "Fehler: " + error.message : "Gespeichert ✓",
    }));
    router.refresh();
  }

  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {teams.map((t) => {
        const s = state[t.id];
        return (
          <div key={t.id} className="p-4">
            <div className="mb-2 font-semibold text-slate-900">{t.name}</div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-[12px] text-slate-600">
                Mannschaftsführer
                <select
                  value={s.mf}
                  onChange={(e) =>
                    setState((st) => ({
                      ...st,
                      [t.id]: { ...st[t.id], mf: e.target.value },
                    }))
                  }
                  className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="">— keiner —</option>
                  {t.kader.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] text-slate-600">
                Stellvertreter (optional)
                <select
                  value={s.stellv}
                  onChange={(e) =>
                    setState((st) => ({
                      ...st,
                      [t.id]: { ...st[t.id], stellv: e.target.value },
                    }))
                  }
                  className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="">— keiner —</option>
                  {t.kader
                    .filter((k) => k.id !== s.mf)
                    .map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                onClick={() => save(t)}
                disabled={busy === t.id}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                Speichern
              </button>
              {info[t.id] && (
                <span className="text-[12px] text-slate-500">{info[t.id]}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
