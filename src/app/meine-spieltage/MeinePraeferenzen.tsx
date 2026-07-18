"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MeinePraeferenzen({
  praeferenzen,
}: {
  praeferenzen: Record<string, unknown>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [nurHeim, setNurHeim] = useState(!!praeferenzen?.nur_heimspiele);
  const [keineDoppel, setKeineDoppel] = useState(
    !!praeferenzen?.keine_doppeleinsaetze
  );
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function speichern(next: { nur: boolean; doppel: boolean }) {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.rpc("set_my_praeferenzen", {
      p_praeferenzen: {
        ...praeferenzen,
        nur_heimspiele: next.nur,
        keine_doppeleinsaetze: next.doppel,
      },
    });
    setBusy(false);
    setMsg(error ? "Fehler: " + error.message : "Gespeichert ✓");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-1 text-[12px] font-semibold text-slate-500">
        Meine Präferenzen
      </div>
      <p className="mb-2 text-[11px] text-slate-400">
        Hinweise für deinen Mannschaftsführer bei der Planung — keine Garantie.
      </p>
      <div className="flex flex-col gap-1.5 text-[13px] text-slate-700">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={nurHeim}
            disabled={busy}
            onChange={(e) => {
              setNurHeim(e.target.checked);
              speichern({ nur: e.target.checked, doppel: keineDoppel });
            }}
          />
          nur Heimspiele
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={keineDoppel}
            disabled={busy}
            onChange={(e) => {
              setKeineDoppel(e.target.checked);
              speichern({ nur: nurHeim, doppel: e.target.checked });
            }}
          />
          keine Doppeleinsätze
        </label>
      </div>
      {msg && <p className="mt-1 text-[12px] text-slate-500">{msg}</p>}
    </section>
  );
}
