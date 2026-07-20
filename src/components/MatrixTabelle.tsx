"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MatrixData, TeamRow, RosterPlayer, Day } from "@/lib/matrix";

const STATUS_UI: Record<string, { label: string; chip: string; cls: string }> = {
  zugesagt: { label: "Zugesagt", chip: "✓", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  unsicher: { label: "Unsicher", chip: "~", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  angefragt: { label: "Angefragt", chip: "?", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  erinnert: { label: "Erinnert", chip: "?", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  abgesagt: { label: "Abgesagt", chip: "✕", cls: "bg-rose-100 text-rose-600 border-rose-200" },
  keine_antwort: { label: "Keine Antwort", chip: "○", cls: "bg-slate-100 text-slate-400 border-slate-200" },
  extern_verplant: { label: "Extern verplant", chip: "⊘", cls: "bg-slate-100 text-slate-400 border-slate-200" },
  nicht_angefragt: { label: "Nicht angefragt", chip: "–", cls: "bg-slate-50 text-slate-300 border-slate-100" },
  pausiert: { label: "Pausiert", chip: "–", cls: "bg-slate-50 text-slate-300 border-slate-100" },
  inaktiv: { label: "Inaktiv", chip: "–", cls: "bg-slate-50 text-slate-300 border-slate-100" },
};

function fmtDatum(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export default function MatrixTabelle({
  teams,
  matrix,
  selectedTeamId,
  basePath = "/",
  zeigeAuswahl = true,
  realtime = true,
}: {
  teams: TeamRow[];
  matrix: MatrixData | null;
  selectedTeamId: string;
  basePath?: string;
  zeigeAuswahl?: boolean;
  realtime?: boolean;
}) {
  const router = useRouter();
  const [nurLuecken, setNurLuecken] = useState(false);

  // Realtime: bei jeder Änderung an Verfügbarkeiten neu laden.
  // (Wird abgeschaltet, wenn ein Eltern-Container das selbst übernimmt.)
  useEffect(() => {
    if (!realtime) return;
    const supabase = createClient();
    const channel = supabase
      .channel("matrix-verfuegbarkeiten")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "verfuegbarkeiten" },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, realtime]);

  const team = matrix?.team;
  const roster = matrix?.roster ?? [];
  const days = matrix?.days ?? [];
  const cells = matrix?.cells ?? {};

  const cellStatus = (p: RosterPlayer, d: Day): string =>
    p.kader_status !== "aktiv"
      ? p.kader_status
      : cells[`${d.id}:${p.spieler_id}`]?.status ?? "nicht_angefragt";

  const dayStats = (d: Day) => {
    const zu = roster.filter(
      (p) => p.kader_status === "aktiv" && cellStatus(p, d) === "zugesagt"
    ).length;
    return { zu, need: team?.spielstaerke ?? 0 };
  };

  const sichtbareDays = useMemo(() => {
    if (!nurLuecken) return days;
    return days.filter((d) => {
      const s = dayStats(d);
      return s.zu < s.need;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, nurLuecken, roster, cells, team]);

  function switchTeam(id: string) {
    router.push(`${basePath}?team=${id}`);
  }

  return (
    <div>
      {zeigeAuswahl && teams.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => switchTeam(t.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                t.id === selectedTeamId
                  ? "border-primary bg-primary text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {t.name}
              <span
                className={`ml-1.5 text-[11px] ${
                  t.id === selectedTeamId ? "text-blue-200" : "text-slate-400"
                }`}
              >
                {t.liga}
              </span>
            </button>
          ))}
        </div>
      )}

      <section className="hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-3">
          <h2 className="mr-auto text-[15px] font-bold tracking-tight">
            {team?.name} · Saison-Matrix
          </h2>
          <label className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
            <input
              type="checkbox"
              checked={nurLuecken}
              onChange={(e) => setNurLuecken(e.target.checked)}
              className="h-4 w-4"
            />
            Nur Lücken zeigen
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-2 text-[11px] text-slate-500">
          {["zugesagt", "angefragt", "abgesagt", "keine_antwort"].map((k) => (
            <span key={k} className="flex items-center gap-1">
              <Chip status={k} /> {STATUS_UI[k].label}
            </span>
          ))}
        </div>

        {days.length === 0 || roster.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            {roster.length === 0
              ? "Für diese Mannschaft ist noch keine Meldung erfasst."
              : "Noch kein Spielplan für diese Mannschaft erfasst."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Spieler
                  </th>
                  {sichtbareDays.map((d) => {
                    const st = dayStats(d);
                    const ok = st.zu >= st.need;
                    // Spieltag-Detail ist für alle ansehbar; Bearbeiten regelt
                    // die Detailseite (nur Admin/MF der Mannschaft).
                    const kannDetail = true;
                    const inhalt = (
                      <>
                        <div className="text-[11px] font-bold text-slate-700">
                          {fmtDatum(d.datum)}
                          {d.uhrzeit ? ` · ${d.uhrzeit.slice(0, 5)}` : ""}
                        </div>
                        <div className="max-w-[92px] truncate text-[10px] text-slate-500">
                          {d.heim ? "H" : "A"} · {d.gegner}
                        </div>
                        <div
                          className={`mt-1 text-[11px] font-bold ${
                            ok ? "text-emerald-600" : "text-amber-600"
                          }`}
                        >
                          {st.zu}/{st.need} {ok ? "✓" : "⚠"}
                        </div>
                      </>
                    );
                    const boxCls = `block w-full rounded-lg border px-2 py-1.5 text-left ${
                      ok ? "border-slate-200 bg-slate-50" : "border-amber-300 bg-amber-50"
                    }`;
                    return (
                      <th key={d.id} className="px-1.5 py-2 align-bottom">
                        {kannDetail ? (
                          <a href={`/spieltag/${d.id}`} className={`${boxCls} transition hover:shadow`}>
                            {inhalt}
                          </a>
                        ) : (
                          <div className={boxCls}>{inhalt}</div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {roster.map((p) => (
                  <tr key={p.spieler_id} className="border-t border-slate-100">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-1.5">
                      <span className="mr-2 inline-block w-5 text-right text-[11px] font-bold text-slate-300">
                        {p.ersatzHerkunft || p.favorit || p.gemeldetInNummer
                          ? ""
                          : p.position}
                      </span>
                      <span
                        className={
                          p.kader_status !== "aktiv"
                            ? "text-slate-400 line-through"
                            : "font-medium"
                        }
                      >
                        {p.name}
                      </span>
                      {p.ersatzHerkunft && (
                        <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                          Ersatz · {p.ersatzHerkunft}. M.
                        </span>
                      )}
                      {p.favorit && (
                        <span className="ml-2 rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700">
                          Favorit
                        </span>
                      )}
                      {p.gemeldetInNummer && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                          gem. {p.gemeldetInNummer}. M.
                        </span>
                      )}
                      {p.kader_status === "pausiert" && (
                        <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                          pausiert
                        </span>
                      )}
                      {p.kader_status === "inaktiv" && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                          inaktiv
                        </span>
                      )}
                    </td>
                    {sichtbareDays.map((d) => {
                      const c = cells[`${d.id}:${p.spieler_id}`];
                      if (p.ersatzHerkunft && !c) {
                        return (
                          <td
                            key={d.id}
                            className="px-1.5 py-1.5 text-center text-slate-200"
                          >
                            ·
                          </td>
                        );
                      }
                      return (
                        <td key={d.id} className="px-1.5 py-1.5 text-center">
                          <Chip status={cellStatus(p, d)} cell={c} datum={d.datum} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-100 px-4 py-2.5 text-[12px] text-slate-500">
          Änderungen erscheinen dank Live-Aktualisierung sofort. Zahl im
          Spaltenkopf: Zusagen / benötigte Spieler.
        </div>
      </section>

      {/* Mobil: eine Karte pro Spieltag statt der breiten Tabelle */}
      <div className="md:hidden">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-slate-800">
            {team?.name} · Spieltage
          </h2>
          <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
            <input
              type="checkbox"
              checked={nurLuecken}
              onChange={(e) => setNurLuecken(e.target.checked)}
              className="h-4 w-4"
            />
            Nur Lücken
          </label>
        </div>

        {sichtbareDays.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
            {days.length === 0
              ? "Noch kein Spielplan erfasst."
              : "Keine offenen Lücken. 👍"}
          </div>
        ) : (
          <div className="space-y-2.5">
            {sichtbareDays.map((d) => {
              const zu: string[] = [];
              const ab: string[] = [];
              const offen: string[] = [];
              for (const p of roster) {
                if (p.kader_status !== "aktiv") continue;
                const s = cellStatus(p, d);
                if (s === "zugesagt") zu.push(p.name);
                else if (s === "abgesagt" || s === "extern_verplant") ab.push(p.name);
                else if (!p.favorit && !p.ersatzHerkunft) offen.push(p.name);
              }
              const need = team?.spielstaerke ?? 0;
              const ok = zu.length >= need;
              return (
                <a
                  key={d.id}
                  href={`/spieltag/${d.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-3 hover:border-primary"
                >
                  <div className="flex items-start gap-2">
                    <div className="mr-auto">
                      <div className="text-[15px] font-medium text-slate-900">
                        {fmtDatum(d.datum)}
                        {d.uhrzeit ? ` · ${d.uhrzeit.slice(0, 5)}` : ""}
                      </div>
                      <div className="text-[13px] text-slate-500">
                        {d.heim ? "Heim" : "Auswärts"} gegen {d.gegner}
                      </div>
                    </div>
                    <span
                      className={`whitespace-nowrap rounded-lg px-2 py-0.5 text-[13px] font-bold ${
                        ok
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {zu.length}/{need} {ok ? "✓" : "⚠"}
                    </span>
                  </div>
                  <div className="mt-2.5 space-y-1.5 border-t border-slate-100 pt-2.5 text-[13px]">
                    <NameZeile farbe="bg-emerald-500" label="Zugesagt" namen={zu} />
                    <NameZeile farbe="bg-amber-500" label="Offen" namen={offen} />
                    <NameZeile farbe="bg-rose-500" label="Abgesagt" namen={ab} />
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function NameZeile({
  farbe,
  label,
  namen,
}: {
  farbe: string;
  label: string;
  namen: string[];
}) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${farbe}`} />
      <span className="w-16 flex-none text-slate-500">
        {label} {namen.length > 0 && <span className="text-slate-400">({namen.length})</span>}
      </span>
      <span className="text-slate-700">
        {namen.length ? namen.join(", ") : "—"}
      </span>
    </div>
  );
}

function Chip({
  status,
  cell,
}: {
  status: string;
  cell?: { kommentar: string | null; quelle: string; updated_at: string } | undefined;
  datum?: string;
}) {
  const u = STATUS_UI[status] ?? STATUS_UI["nicht_angefragt"];
  const proxy = cell?.quelle === "proxy";
  const titleParts = [u.label];
  if (cell) {
    if (cell.updated_at) {
      titleParts.push(
        "Stand: " +
          new Date(cell.updated_at).toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
      );
    }
    if (cell.quelle) titleParts.push("Quelle: " + cell.quelle);
    if (cell.kommentar) titleParts.push("„" + cell.kommentar + "“");
  }
  return (
    <span
      title={titleParts.join(" · ")}
      className={`relative inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-bold ${u.cls}`}
    >
      {u.chip}
      {proxy && (
        <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-blue-500 text-[8px] text-white">
          P
        </span>
      )}
    </span>
  );
}
