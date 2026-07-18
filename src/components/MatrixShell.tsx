"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AppHeader from "@/components/AppHeader";
import type { MatrixData, TeamRow, RosterPlayer, Day } from "@/lib/matrix";

// ── Status → Chip-Darstellung ────────────────────────────────────────────────
const STATUS_UI: Record<
  string,
  { label: string; chip: string; cls: string }
> = {
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
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export default function MatrixShell({
  teams,
  matrix,
  selectedTeamId,
  userEmail,
  isAdmin = false,
  isMf = false,
  realIsAdmin = false,
  realIsMf = false,
  hatManagement = false,
  spielerModus = false,
  basePath = "/",
}: {
  teams: TeamRow[];
  matrix: MatrixData | null;
  selectedTeamId: string;
  userEmail: string;
  isAdmin?: boolean;
  isMf?: boolean;
  realIsAdmin?: boolean;
  realIsMf?: boolean;
  hatManagement?: boolean;
  spielerModus?: boolean;
  basePath?: string;
}) {
  const router = useRouter();
  const [nurLuecken, setNurLuecken] = useState(false);

  // Realtime: bei jeder Änderung an Verfügbarkeiten die Serverdaten neu laden.
  useEffect(() => {
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
  }, [router]);

  const team = matrix?.team;
  const roster = matrix?.roster ?? [];
  const days = matrix?.days ?? [];
  const cells = matrix?.cells ?? {};

  const cellStatus = (p: RosterPlayer, d: Day): string =>
    p.kader_status !== "aktiv"
      ? p.kader_status // pausiert | inaktiv
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <AppHeader
        userEmail={userEmail}
        isAdmin={isAdmin}
        isMf={isMf}
        realIsAdmin={realIsAdmin}
        realIsMf={realIsMf}
        hatManagement={hatManagement}
        spielerModus={spielerModus}
      />

      {/* Mannschaftswahl */}
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="flex flex-wrap gap-2">
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
      </div>

      <main className="mx-auto max-w-6xl px-4 py-5">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
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

          {/* Legende */}
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
                      return (
                        <th key={d.id} className="px-1.5 py-2 align-bottom">
                          <a
                            href={`/spieltag/${d.id}`}
                            className={`block w-full rounded-lg border px-2 py-1.5 text-left transition hover:shadow ${
                              ok
                                ? "border-slate-200 bg-slate-50"
                                : "border-amber-300 bg-amber-50"
                            }`}
                          >
                            <div className="text-[11px] font-bold text-slate-700">
                              {fmtDatum(d.datum)}
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
                          </a>
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
                          {p.ersatzHerkunft ? "" : p.position}
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
                            <Chip
                              status={cellStatus(p, d)}
                              cell={c}
                              datum={d.datum}
                            />
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
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-6 text-[11px] text-slate-400">
        Phase 1 · Meilenstein 2: Login &amp; Saison-Matrix · Demo-Daten
      </footer>
    </div>
  );
}

function Chip({
  status,
  cell,
  datum,
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
