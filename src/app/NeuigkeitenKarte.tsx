"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Neuigkeit } from "@/lib/neuigkeiten";

const MERKER = "neuigkeiten_gelesen_bis";

// „Was ist neu"-Karte auf der Startseite. Zeigt nur ungelesene, rollen-
// relevante Neuigkeiten. „Alles gelesen" merkt den Stand serverseitig (pro
// Konto) UND lokal im Browser — Letzteres greift sofort und unabhängig davon,
// ob die serverseitige Speicherung schon eingerichtet ist.
export default function NeuigkeitenKarte({ items }: { items: Neuigkeit[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [weg, setWeg] = useState(false);

  // Neuestes Datum der aktuell offenen Einträge
  const maxDatum = items.reduce((m, n) => (n.datum > m ? n.datum : m), "");

  // Wurde bereits mindestens bis zu diesem Stand bestätigt? Dann ausblenden.
  useEffect(() => {
    try {
      const bis = localStorage.getItem(MERKER);
      if (bis && maxDatum && bis >= maxDatum) setWeg(true);
    } catch {
      /* localStorage evtl. nicht verfügbar */
    }
  }, [maxDatum]);

  if (weg || items.length === 0) return null;

  async function gelesen() {
    setBusy(true);
    try {
      localStorage.setItem(MERKER, maxDatum);
    } catch {
      /* ignorieren */
    }
    const supabase = createClient();
    await supabase.rpc("mark_neuigkeiten_gesehen");
    setBusy(false);
    setWeg(true);
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">✨</span>
        <h2 className="mr-auto text-[15px] font-bold text-sky-900">
          Was ist neu
        </h2>
        <button
          onClick={gelesen}
          disabled={busy}
          className="rounded-lg border border-sky-300 bg-white px-2.5 py-1 text-[12px] font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
        >
          {busy ? "…" : "Alles gelesen"}
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className="rounded-lg bg-white/70 p-2.5">
            <div className="text-[13px] font-semibold text-slate-800">
              {n.titel}
            </div>
            <div className="mt-0.5 text-[12px] leading-relaxed text-slate-600">
              {n.text}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-right">
        <a
          href="/neuigkeiten"
          className="text-[12px] font-medium text-sky-700 hover:underline"
        >
          Alle Neuigkeiten ansehen →
        </a>
      </div>
    </section>
  );
}
