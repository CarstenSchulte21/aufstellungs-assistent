"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type ProxyOpt = { id: string; name: string };
export type SpieltagRow = {
  id: string;
  spieltag_nr: number;
  datum: string;
  uhrzeit: string | null;
  heim: boolean;
  gegner: string;
  status: string;
  kommentar: string | null;
};
export type AbwRow = { id: string; von: string; bis: string; grund: string | null };
export type ErsatzRow = {
  id: string;
  status: string;
  frist_bis: string | null;
  datum: string;
  uhrzeit: string | null;
  spieltag_nr: number;
  heim: boolean;
  gegner: string;
  teamNummer: number;
  teamName: string;
};

function fmt(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Kompakt für Listenzeilen (ohne Jahr) — spart Platz neben den Buttons.
function fmtTag(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function heute() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const OFFEN_STATUS = ["angefragt", "erinnert", "keine_antwort"];

type Aufgabe = {
  titel: string;
  detail: string;
  datum: string;
  anker: string;
  cls: string;
};

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  zugesagt: { label: "Zugesagt", cls: "bg-emerald-100 text-emerald-700" },
  abgesagt: { label: "Abgesagt", cls: "bg-rose-100 text-rose-600" },
  unsicher: { label: "Unsicher", cls: "bg-amber-100 text-amber-700" },
  angefragt: { label: "Angefragt", cls: "bg-amber-50 text-amber-700" },
  erinnert: { label: "Erinnert", cls: "bg-amber-50 text-amber-700" },
  keine_antwort: { label: "Keine Antwort", cls: "bg-slate-100 text-slate-500" },
  nicht_angefragt: { label: "—", cls: "bg-slate-50 text-slate-400" },
};

export default function MeineSpieltageClient({
  zielId,
  proxyOpts,
  spieltage,
  abwesenheiten,
  ersatzanfragen = [],
}: {
  zielId: string;
  proxyOpts: ProxyOpt[];
  spieltage: SpieltagRow[];
  abwesenheiten: AbwRow[];
  ersatzanfragen?: ErsatzRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [grund, setGrund] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [eVon, setEVon] = useState("");
  const [eBis, setEBis] = useState("");
  const [eGrund, setEGrund] = useState("");

  function startEdit(a: AbwRow) {
    setEditId(a.id);
    setEVon(a.von);
    setEBis(a.bis);
    setEGrund(a.grund ?? "");
  }

  async function antwortErsatz(id: string, ant: "ja" | "nein") {
    setBusy("ers:" + id);
    await fetch("/api/ersatz/antwort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ersatzanfrage_id: id, antwort: ant }),
    });
    setBusy(null);
    router.refresh();
  }

  async function updateAbw(id: string) {
    if (!eVon || !eBis) return;
    setBusy(id);
    await supabase
      .from("abwesenheiten")
      .update({ von: eVon, bis: eBis, grund: eGrund || null })
      .eq("id", id);
    setEditId(null);
    setBusy(null);
    router.refresh();
  }

  async function antwort(spielId: string, status: "zugesagt" | "abgesagt") {
    setBusy(spielId);
    await supabase.from("verfuegbarkeiten").upsert(
      { spiel_id: spielId, spieler_id: zielId, status, quelle: "webapp" },
      { onConflict: "spiel_id,spieler_id" }
    );
    setBusy(null);
    router.refresh();
  }

  async function addAbw(e: React.FormEvent) {
    e.preventDefault();
    if (!von || !bis) return;
    setBusy("abw");
    await supabase.from("abwesenheiten").insert({
      spieler_id: zielId,
      von,
      bis,
      grund: grund || null,
      quelle: "webapp",
    });
    setVon("");
    setBis("");
    setGrund("");
    setBusy(null);
    router.refresh();
  }

  async function delAbw(id: string) {
    setBusy(id);
    await supabase.from("abwesenheiten").delete().eq("id", id);
    setBusy(null);
    router.refresh();
  }

  function switchZiel(id: string) {
    router.push(`/meine-spieltage?fuer=${id}`);
  }

  const h = heute();
  const aufgaben: Aufgabe[] = [];
  for (const s of spieltage) {
    if (s.datum < h) continue;
    const gegen = `${s.heim ? "Heim" : "Auswärts"} gegen ${s.gegner}`;
    if (OFFEN_STATUS.includes(s.status))
      aufgaben.push({
        titel: "Verfügbarkeit offen",
        detail: gegen,
        datum: s.datum,
        anker: `s-${s.id}`,
        cls: "bg-amber-100 text-amber-700",
      });
    else if (s.status === "unsicher")
      aufgaben.push({
        titel: "Unsicher – bitte festlegen",
        detail: gegen,
        datum: s.datum,
        anker: `s-${s.id}`,
        cls: "bg-amber-50 text-amber-700",
      });
  }
  for (const a of ersatzanfragen) {
    if (a.datum < h) continue;
    if (!["gesendet", "freigegeben"].includes(a.status)) continue;
    aufgaben.push({
      titel: "Ersatzanfrage offen",
      detail: `Aushilfe für die ${a.teamNummer}. Mannschaft`,
      datum: a.datum,
      anker: `e-${a.id}`,
      cls: "bg-blue-50 text-blue-700",
    });
  }
  aufgaben.sort((x, y) => (x.datum < y.datum ? -1 : x.datum > y.datum ? 1 : 0));

  return (
    <div className="space-y-6">
      {proxyOpts.length > 1 && (
        <label className="block text-sm font-medium text-slate-700">
          Ich trage ein für:
          <select
            value={zielId}
            onChange={(e) => switchZiel(e.target.value)}
            className="ml-2 rounded-lg border border-slate-300 px-2 py-1 text-sm"
          >
            {proxyOpts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Offene Aufgaben */}
      {aufgaben.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <h2 className="mb-2 text-[15px] font-bold text-slate-800">
            Das brauchst du noch ({aufgaben.length})
          </h2>
          <div className="space-y-1.5">
            {aufgaben.map((a, i) => (
              <a
                key={i}
                href={`#${a.anker}`}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2 text-[13px] hover:border-amber-300"
              >
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${a.cls}`}
                >
                  {a.titel}
                </span>
                <span className="text-slate-600">{a.detail}</span>
                <span className="ml-auto text-[12px] text-slate-400">
                  {fmt(a.datum)}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Spieltage */}
      <section>
        <h2 className="mb-2 text-[15px] font-bold text-slate-800">
          Kommende Spieltage
        </h2>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {spieltage.length === 0 && (
            <p className="p-4 text-sm text-slate-500">
              Keine Spieltage gefunden.
            </p>
          )}
          {spieltage.map((s) => {
            const ui = STATUS_UI[s.status] ?? STATUS_UI.nicht_angefragt;
            return (
              <div
                key={s.id}
                id={`s-${s.id}`}
                className="flex scroll-mt-4 flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3"
              >
                <div className="min-w-0 sm:mr-auto">
                  <div className="text-sm font-medium text-slate-900">
                    {fmtTag(s.datum)}
                    {s.uhrzeit ? ` · ${s.uhrzeit.slice(0, 5)}` : ""}
                  </div>
                  <div className="truncate text-[13px] text-slate-600">
                    {s.heim ? "Heim" : "Auswärts"} gegen {s.gegner}
                  </div>
                  <div className="text-[12px] text-slate-500">
                    Spieltag {s.spieltag_nr}
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 font-semibold ${ui.cls}`}
                    >
                      {ui.label}
                    </span>
                    {s.kommentar && (
                      <span className="ml-2 text-slate-400">· {s.kommentar}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-none gap-2">
                  <button
                    onClick={() => antwort(s.id, "zugesagt")}
                    disabled={busy === s.id}
                    className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold sm:flex-none ${
                      s.status === "zugesagt"
                        ? "bg-emerald-500 text-white"
                        : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    ✓ Zusagen
                  </button>
                  <button
                    onClick={() => antwort(s.id, "abgesagt")}
                    disabled={busy === s.id}
                    className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold sm:flex-none ${
                      s.status === "abgesagt"
                        ? "bg-rose-500 text-white"
                        : "border border-rose-300 text-rose-600 hover:bg-rose-50"
                    }`}
                  >
                    ✕ Absagen
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Ersatzanfragen an mich */}
      {ersatzanfragen.length > 0 && (
        <section>
          <h2 className="mb-2 text-[15px] font-bold text-slate-800">
            Ersatzanfragen an mich
          </h2>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {ersatzanfragen.map((a) => {
              const offen = ["gesendet", "freigegeben"].includes(a.status);
              const zugesagt = a.status === "zugesagt" || a.status === "eingeplant";
              return (
                <div
                  key={a.id}
                  id={`e-${a.id}`}
                  className="flex scroll-mt-4 flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="min-w-0 sm:mr-auto">
                    <div className="text-sm font-medium text-slate-900">
                      {fmtTag(a.datum)}
                      {a.uhrzeit ? ` · ${a.uhrzeit.slice(0, 5)}` : ""}
                    </div>
                    <div className="truncate text-[13px] text-slate-600">
                      {a.heim ? "Heim" : "Auswärts"} gegen {a.gegner}
                    </div>
                    <div className="text-[12px] text-slate-500">
                      Ersatz für die {a.teamNummer}. Mannschaft
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 font-semibold ${
                          zugesagt
                            ? "bg-emerald-100 text-emerald-700"
                            : a.status === "abgelehnt"
                            ? "bg-rose-100 text-rose-600"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {a.status === "eingeplant"
                          ? "fest eingeplant"
                          : a.status}
                      </span>
                    </div>
                  </div>
                  {a.status !== "eingeplant" && a.status !== "abgelaufen" && (
                    <div className="flex flex-none gap-2">
                      <button
                        onClick={() => antwortErsatz(a.id, "ja")}
                        disabled={busy === "ers:" + a.id}
                        className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold sm:flex-none ${
                          zugesagt
                            ? "bg-emerald-500 text-white"
                            : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        ✓ Ich helfe aus
                      </button>
                      <button
                        onClick={() => antwortErsatz(a.id, "nein")}
                        disabled={busy === "ers:" + a.id}
                        className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold sm:flex-none ${
                          a.status === "abgelehnt"
                            ? "bg-rose-500 text-white"
                            : "border border-rose-300 text-rose-600 hover:bg-rose-50"
                        }`}
                      >
                        ✕ Diesmal nicht
                      </button>
                    </div>
                  )}
                  {offen && (
                    <span className="w-full text-[11px] text-slate-400">
                      Bitte antworten
                      {a.frist_bis
                        ? ` bis ${new Date(a.frist_bis).toLocaleString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : ""}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Abwesenheiten */}
      <section>
        <h2 className="mb-2 text-[15px] font-bold text-slate-800">
          Abwesenheiten
        </h2>
        <p className="mb-2 text-[12px] text-slate-500">
          Ein Zeitraum sagt alle Spieltage darin automatisch ab.
        </p>
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-100">
            {abwesenheiten.length === 0 && (
              <p className="p-3 text-sm text-slate-500">
                Keine Abwesenheiten eingetragen.
              </p>
            )}
            {abwesenheiten.map((a) =>
              editId === a.id ? (
                <div
                  key={a.id}
                  className="flex flex-wrap items-end gap-2 p-3 text-sm"
                >
                  <label className="text-[12px] text-slate-600">
                    Von
                    <input
                      type="date"
                      value={eVon}
                      onChange={(e) => setEVon(e.target.value)}
                      className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-[12px] text-slate-600">
                    Bis
                    <input
                      type="date"
                      value={eBis}
                      onChange={(e) => setEBis(e.target.value)}
                      className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-[12px] text-slate-600">
                    Grund
                    <input
                      type="text"
                      value={eGrund}
                      onChange={(e) => setEGrund(e.target.value)}
                      placeholder="Urlaub"
                      className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <button
                    onClick={() => updateAbw(a.id)}
                    disabled={busy === a.id}
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
                  >
                    Speichern
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
                  >
                    Abbrechen
                  </button>
                </div>
              ) : (
                <div
                  key={a.id}
                  className="flex items-center gap-3 p-3 text-sm"
                >
                  <span className="mr-auto text-slate-700">
                    {fmt(a.von)} – {fmt(a.bis)}
                    {a.grund && (
                      <span className="ml-2 text-slate-400">· {a.grund}</span>
                    )}
                  </span>
                  <button
                    onClick={() => startEdit(a)}
                    className="text-[13px] font-medium text-primary hover:underline"
                  >
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => delAbw(a.id)}
                    disabled={busy === a.id}
                    className="text-[13px] font-medium text-rose-600 hover:underline"
                  >
                    Löschen
                  </button>
                </div>
              )
            )}
          </div>
          <form
            onSubmit={addAbw}
            className="flex flex-wrap items-end gap-2 border-t border-slate-100 p-3"
          >
            <label className="text-[12px] text-slate-600">
              Von
              <input
                type="date"
                value={von}
                onChange={(e) => setVon(e.target.value)}
                required
                className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="text-[12px] text-slate-600">
              Bis
              <input
                type="date"
                value={bis}
                onChange={(e) => setBis(e.target.value)}
                required
                className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="text-[12px] text-slate-600">
              Grund (optional)
              <input
                type="text"
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                placeholder="Urlaub"
                className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={busy === "abw"}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Hinzufügen
            </button>
          </form>
        </div>
      </section>

      <p className="text-[12px] text-slate-400">
        Für den Verein sichtbar sind deine Status in der Matrix. Freitext-
        Kommentare sehen nur du, dein Mannschaftsführer und der Admin.
      </p>
    </div>
  );
}
