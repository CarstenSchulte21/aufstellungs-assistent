"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ConsentForm() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");

  async function accept() {
    setBusy(true);
    setFehler("");
    const supabase = createClient();
    const { error } = await supabase.rpc("set_dsgvo_consent");
    if (error) {
      setFehler(error.message);
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mt-5">
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          Ich habe die Informationen gelesen und willige in die Verarbeitung
          meiner Daten zu diesem Zweck ein.
        </span>
      </label>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={accept}
          disabled={!checked || busy}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {busy ? "Speichern…" : "Einwilligen und starten"}
        </button>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-sm font-medium text-slate-500 hover:underline"
          >
            Abmelden
          </button>
        </form>
      </div>
      {fehler && <p className="mt-2 text-sm text-rose-600">Fehler: {fehler}</p>}
    </div>
  );
}
