import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

type Spiel = {
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
  const tag = (d.getUTCDay() + 6) % 7; // Mo=0 … So=6
  d.setUTCDate(d.getUTCDate() - tag + 3); // auf den Donnerstag der Woche
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

export default async function SpieltageUebersicht() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: hs } = await supabase
    .from("halbserien")
    .select("id, bezeichnung")
    .eq("aktiv", true)
    .maybeSingle();

  let spiele: Spiel[] = [];
  if (hs?.id) {
    const { data } = await supabase
      .from("spiele")
      .select(
        "id, datum, uhrzeit, heim, gegner, status, mannschaften:mannschaft_id(name, nummer)"
      )
      .eq("halbserie_id", hs.id)
      .order("datum", { ascending: true })
      .order("uhrzeit", { ascending: true });
    spiele = (data ?? []).map((s: any) => ({
      id: s.id,
      datum: s.datum,
      uhrzeit: s.uhrzeit ?? null,
      heim: s.heim,
      gegner: s.gegner,
      status: s.status,
      teamName: s.mannschaften?.name ?? "—",
      teamNummer: s.mannschaften?.nummer ?? 99,
    }));
  }

  // Nach KW gruppieren (Reihenfolge bleibt chronologisch durch die Sortierung)
  const gruppen: { key: string; kw: number; jahr: number; spiele: Spiel[] }[] =
    [];
  for (const s of spiele) {
    const { jahr, kw } = isoWoche(s.datum);
    const key = `${jahr}-${kw}`;
    let g = gruppen.find((x) => x.key === key);
    if (!g) {
      g = { key, kw, jahr, spiele: [] };
      gruppen.push(g);
    }
    g.spiele.push(s);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userEmail={user?.email ?? ""}
        isAdmin={session.isAdmin}
        isMf={session.isMf}
        realIsAdmin={session.realIsAdmin}
        realIsMf={session.realIsMf}
        hatManagement={session.hatManagement}
        modus={session.modus}
        spielerCount={0}
      />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Alle Spieltage
            </h1>
            <p className="text-[13px] text-slate-500">
              {hs?.bezeichnung ? `${hs.bezeichnung} · ` : ""}alle Mannschaften,
              nach Kalenderwoche
            </p>
          </div>
        </div>

        {gruppen.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Für die laufende Halbserie sind noch keine Spieltage angelegt.
          </div>
        ) : (
          <div className="space-y-5">
            {gruppen.map((g) => (
              <section key={g.key}>
                <div className="mb-1.5 flex items-baseline gap-2">
                  <h2 className="text-[13px] font-bold uppercase tracking-wide text-primary">
                    KW {g.kw}
                  </h2>
                  <span className="text-[12px] text-slate-400">{g.jahr}</span>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {g.spiele.map((s, i) => {
                    const abgesetzt = s.status === "abgesetzt";
                    return (
                      <a
                        key={s.id}
                        href={`/spieltag/${s.id}`}
                        className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[13px] hover:bg-slate-50 ${
                          i > 0 ? "border-t border-slate-100" : ""
                        } ${abgesetzt ? "opacity-60" : ""}`}
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
                        <span className="mr-auto text-slate-700">
                          {s.gegner}
                        </span>
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
