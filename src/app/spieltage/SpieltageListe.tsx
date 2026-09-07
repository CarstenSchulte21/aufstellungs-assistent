"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Spiel = {
  id: string;
  datum: string;
  uhrzeit: string | null;
  heim: boolean;
  gegner: string;
  status: string;
  teamName: string;
  teamNummer: number;
};

// ISO-8601-Kalenderwoche (Woche mit dem ersten Donnerstag zählt als KW 1).
function isoWoche(iso: string): { jahr: number; kw: number } {
  const d = new Date(
    Date.UTC(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)) - 1,
      Number(iso.slice(8, 10))
    )
  );
  const tag = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - tag + 3);
  const ersterDo = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const kw =
    1 +
    Math.round(
      (d.getTime() - ersterDo.getTime()) / 86400000 / 7 -
        ((ersterDo.getUTCDay() + 6) % 7) / 7
    );
  return { jahr: d.getUTCFullYear(), kw };
}

function fmtTag(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

type Gruppe = {
  key: string;
  kw: number;
  jahr: number;
  spiele: Spiel[];
  hatKommend: boolean;
};

export default function SpieltageListe({
  spiele,
  heute,
}: {
  spiele: Spiel[];
  heute: string;
}) {
  const [vergangeneAus, setVergangeneAus] = useState(false);
  const heuteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setVergangeneAus(
        localStorage.getItem("spieltage_vergangene_aus") === "1"
      );
    } catch {
      /* ignorieren */
    }
  }, []);
  function toggle(v: boolean) {
    setVergangeneAus(v);
    try {
      localStorage.setItem("spieltage_vergangene_aus", v ? "1" : "0");
    } catch {
      /* ignorieren */
    }
  }

  const vorbei = (s: Spiel) => s.datum < heute;

  const gruppen = useMemo(() => {
    const liste = vergangeneAus ? spiele.filter((s) => !vorbei(s)) : spiele;
    const g: Gruppe[] = [];
    for (const s of liste) {
      const { jahr, kw } = isoWoche(s.datum);
      const key = `${jahr}-${kw}`;
      let grp = g.find((x) => x.key === key);
      if (!grp) {
        grp = { key, kw, jahr, spiele: [], hatKommend: false };
        g.push(grp);
      }
      grp.spiele.push(s);
      if (!vorbei(s)) grp.hatKommend = true;
    }
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spiele, vergangeneAus, heute]);

  // Erste Gruppe mit kommenden Spielen (für „Heute"-Linie + Anker)
  const ersteKommendIdx = gruppen.findIndex((g) => g.hatKommend);

  useEffect(() => {
    if (ersteKommendIdx <= 0) return;
    const t = setTimeout(() => {
      heuteRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
    return () => clearTimeout(t);
  }, [ersteKommendIdx, vergangeneAus]);

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <label className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
          <input
            type="checkbox"
            checked={vergangeneAus}
            onChange={(e) => toggle(e.target.checked)}
            className="h-4 w-4"
          />
          Vergangene ausblenden
        </label>
      </div>

      {gruppen.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {vergangeneAus
            ? "Keine kommenden Spieltage."
            : "Für die laufende Halbserie sind noch keine Spieltage angelegt."}
        </div>
      ) : (
        <div className="space-y-5">
          {gruppen.map((g, gi) => {
            const gruppeVorbei = !g.hatKommend;
            const zeigeHeuteLinie = gi === ersteKommendIdx && ersteKommendIdx > 0;
            return (
              <div key={g.key}>
                {zeigeHeuteLinie && (
                  <div
                    ref={heuteRef}
                    className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary"
                  >
                    <span className="h-px flex-1 bg-primary/30" />
                    Heute — ab hier kommende Spiele
                    <span className="h-px flex-1 bg-primary/30" />
                  </div>
                )}
                <section className={gruppeVorbei ? "opacity-60" : ""}>
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <h2 className="text-[13px] font-bold uppercase tracking-wide text-primary">
                      KW {g.kw}
                    </h2>
                    <span className="text-[12px] text-slate-400">{g.jahr}</span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {g.spiele.map((s, i) => {
                      const abgesetzt = s.status === "abgesetzt";
                      const sVorbei = vorbei(s);
                      return (
                        <a
                          key={s.id}
                          href={`/spieltag/${s.id}`}
                          className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[13px] hover:bg-slate-50 ${
                            i > 0 ? "border-t border-slate-100" : ""
                          } ${abgesetzt || (sVorbei && !gruppeVorbei) ? "opacity-60" : ""}`}
                        >
                          <span className="w-28 shrink-0 font-medium text-slate-700">
                            {fmtTag(s.datum)}
                            {s.uhrzeit ? (
                              <span className="ml-1 text-slate-400">
                                {String(s.uhrzeit).slice(0, 5)}
                              </span>
                            ) : null}
                          </span>
                          <span className="w-32 shrink-0 font-semibold text-slate-900">
                            {s.teamName}
                          </span>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                              s.heim
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {s.heim ? "Heim" : "Ausw."}
                          </span>
                          <span className="mr-auto text-slate-700">{s.gegner}</span>
                          {abgesetzt && (
                            <span className="shrink-0 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
                              abgesetzt
                            </span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                </section>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
