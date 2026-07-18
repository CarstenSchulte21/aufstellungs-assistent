"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type BearbeitenData = {
  datum: string;
  uhrzeit: string;
  heim: boolean;
  ort: string;
  status: string;
  verlegtVon: string | null;
};

export default function SpielAendern({
  spielId,
  data,
}: {
  spielId: string;
  data: BearbeitenData;
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const [datum, setDatum] = useState(data.datum);
  const [uhrzeit, setUhrzeit] = useState((data.uhrzeit ?? "").slice(0, 5));
  const [heim, setHeim] = useState(data.heim);
  const [ort, setOrt] = useState(data.ort ?? "");

  async function ruf(typ: string, payload: Record<string, unknown>) {
    setBusy(typ);
    setMsg("");
    const res = await fetch("/api/spielplan/aendern", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spiel_id: spielId, typ, ...payload }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setMsg("Fehler: " + (json.error ?? "unbekannt"));
      return;
    }
    if (typ === "verlegen" && json.verlegt)
      setMsg(`Verlegt · ${json.neuAbgefragt} Spieler neu angefragt.`);
    else if (json.informiert != null)
      setMsg(`Gespeichert · ${json.informiert} informiert.`);
    else setMsg("Gespeichert.");
    router.refresh();
  }

  async function absetzen() {
    if (
      !confirm(
        "Spiel wirklich als abgesetzt markieren? Alle bisher Beteiligten werden informiert."
      )
    )
      return;
    await ruf("absetzen", {});
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[15px] font-bold text-slate-800">Spiel bearbeiten</h3>
        {data.verlegtVon && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
            verlegt (ursprgl. {data.verlegtVon})
          </span>
        )}
        {data.status === "abgesetzt" && (
          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
            abgesetzt
          </span>
        )}
        <button
          onClick={() => setOffen((o) => !o)}
          className="ml-auto rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[13px] font-medium text-slate-700 hover:border-slate-400"
        >
          {offen ? "Schließen" : "Ändern"}
        </button>
      </div>

      {offen && (
        <div className="mt-3 space-y-4">
          {/* Verlegen */}
          <div className="rounded-lg border border-slate-100 p-3">
            <div className="mb-2 text-[13px] font-semibold text-slate-700">
              Termin verlegen
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[12px] text-slate-600">
                Datum
                <input
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                  className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="text-[12px] text-slate-600">
                Uhrzeit
                <input
                  type="time"
                  value={uhrzeit}
                  onChange={(e) => setUhrzeit(e.target.value)}
                  className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              <button
                onClick={() => ruf("verlegen", { datum, uhrzeit })}
                disabled={busy === "verlegen"}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {busy === "verlegen" ? "…" : "Verlegen"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Bei geändertem Datum werden bestehende Zusagen zurückgesetzt und der
              Stamm für den neuen Termin automatisch neu gefragt.
            </p>
          </div>

          {/* Heimrecht / Ort */}
          <div className="rounded-lg border border-slate-100 p-3">
            <div className="mb-2 text-[13px] font-semibold text-slate-700">
              Heimrecht / Ort
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[12px] text-slate-600">
                Heim/Auswärts
                <select
                  value={heim ? "heim" : "ausw"}
                  onChange={(e) => setHeim(e.target.value === "heim")}
                  className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
                >
                  <option value="heim">Heim</option>
                  <option value="ausw">Auswärts</option>
                </select>
              </label>
              <label className="text-[12px] text-slate-600">
                Ort
                <input
                  type="text"
                  value={ort}
                  onChange={(e) => setOrt(e.target.value)}
                  placeholder="Halle / Adresse"
                  className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              <button
                onClick={() => ruf("heimrecht", { heim, ort })}
                disabled={busy === "heimrecht"}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {busy === "heimrecht" ? "…" : "Ändern & informieren"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Zusagen bleiben erhalten; alle Beteiligten werden per Telegram
              informiert.
            </p>
          </div>

          {/* Absetzen */}
          <div className="rounded-lg border border-rose-100 p-3">
            <div className="mb-2 text-[13px] font-semibold text-rose-700">
              Spiel absetzen / Ausfall
            </div>
            <button
              onClick={absetzen}
              disabled={busy === "absetzen" || data.status === "abgesetzt"}
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              {busy === "absetzen"
                ? "…"
                : data.status === "abgesetzt"
                ? "Bereits abgesetzt"
                : "Spiel absetzen"}
            </button>
          </div>

          {msg && <p className="text-[12px] text-slate-600">{msg}</p>}
        </div>
      )}
    </div>
  );
}
