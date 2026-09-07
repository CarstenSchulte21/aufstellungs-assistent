import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdmin } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { ladeAdoption } from "@/lib/statistik";

export const dynamic = "force-dynamic";

// Sprechende Namen für die normalisierten Pfade
const SEITEN_LABEL: Record<string, string> = {
  "/": "Übersicht (Startseite)",
  "/spieltage": "Alle Spieltage",
  "/meine-spieltage": "Spieltagsplanung",
  "/spieltag/[id]": "Spieltag-Detail",
  "/kader": "Kader",
  "/regeln": "Regeln",
  "/einsaetze": "Einsätze",
  "/koppeln": "Telegram-Kopplung",
  "/neuigkeiten": "Neuigkeiten",
  "/faq": "FAQ",
  "/info": "Info & Hilfe",
  "/konto": "Konto / Passwort",
  "/mannschaft": "Meine Mannschaft",
  "/admin": "Verwaltung",
  "/admin/spielplan": "Verwaltung · Spielplan",
  "/admin/stammdaten": "Verwaltung · Stammdaten",
  "/admin/fuehrung": "Verwaltung · Führung",
  "/admin/admins": "Verwaltung · Administratoren",
  "/admin/statistik": "Verwaltung · Statistik",
};

function label(pfad: string): string {
  return SEITEN_LABEL[pfad] ?? pfad;
}

function fmtDatum(iso: string | null): string {
  if (!iso) return "nie";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function StatistikPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin) redirect("/");

  const adoption = await ladeAdoption(getAdmin());

  // Seitenaufrufe der letzten 30 Tage (aggregiert, anonym)
  const supabase = createClient();
  const seit = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: agg } = await supabase.rpc("seiten_aufrufe_agg", { seit });
  const rows = (agg ?? []) as { pfad: string; rolle: string; anzahl: number }[];

  let gesamt = 0;
  const proPfad = new Map<string, number>();
  const proRolle = new Map<string, number>();
  for (const r of rows) {
    const n = Number(r.anzahl) || 0;
    gesamt += n;
    proPfad.set(r.pfad, (proPfad.get(r.pfad) ?? 0) + n);
    proRolle.set(r.rolle ?? "—", (proRolle.get(r.rolle ?? "—") ?? 0) + n);
  }
  const topPfade = Array.from(proPfad.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  const maxPfad = topPfade[0]?.[1] ?? 1;
  const rollen = Array.from(proRolle.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <a href="/admin" className="text-blue-100 hover:text-white">
            ←
          </a>
          <div className="mr-auto text-[15px] font-bold">Statistik</div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-5">
        {/* Adoption */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-[15px] font-bold text-slate-800">
            Adoption &amp; Erreichbarkeit
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kennzahl label="Spieler gesamt" wert={adoption.spielerGesamt} />
            <Kennzahl label="mit Konto" wert={adoption.mitKonto} />
            <Kennzahl label="ohne Konto" wert={adoption.ohneKonto} ton="warn" />
            <Kennzahl label="mit Telegram" wert={adoption.mitTelegram} />
            <Kennzahl label="mit E-Mail" wert={adoption.mitEmail} />
            <Kennzahl
              label="ohne Kanal"
              wert={adoption.ohneKanal}
              ton={adoption.ohneKanal > 0 ? "warn" : "ok"}
            />
          </div>
        </section>

        {/* Anmelde-Aktivität */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 text-[15px] font-bold text-slate-800">
            Anmelde-Aktivität
          </h2>
          <p className="mb-3 text-[12px] text-slate-500">
            Bezogen auf verknüpfte Konten ({adoption.mitKonto}).
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Kennzahl
              label="aktiv (30 Tage)"
              wert={adoption.angemeldet30}
              ton="ok"
            />
            <Kennzahl
              label="länger als 30 Tage"
              wert={adoption.laenger30}
              ton={adoption.laenger30 > 0 ? "warn" : "ok"}
            />
            <Kennzahl
              label="nie angemeldet"
              wert={adoption.nieAngemeldet}
              ton={adoption.nieAngemeldet > 0 ? "warn" : "ok"}
            />
          </div>

          {adoption.stille.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-[12px] font-semibold text-slate-500">
                Stille Nutzer (nie oder lange nicht angemeldet)
              </div>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {adoption.stille.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between px-3 py-1.5 text-[13px]"
                  >
                    <span className="text-slate-700">{s.name}</span>
                    <span className="text-slate-400">
                      {fmtDatum(s.letzteAnmeldung)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Seitenaufrufe */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-1 text-[15px] font-bold text-slate-800">
            Seitenaufrufe (letzte 30 Tage)
          </h2>
          <p className="mb-3 text-[12px] text-slate-500">
            Anonym erfasst — nur Seite und Rolle, kein Personenbezug. Gesamt:{" "}
            <strong>{gesamt}</strong>
            {rollen.length > 0 && (
              <>
                {" · "}
                {rollen.map(([r, n], i) => (
                  <span key={r}>
                    {i > 0 ? ", " : ""}
                    {r}: {n}
                  </span>
                ))}
              </>
            )}
          </p>

          {topPfade.length === 0 ? (
            <p className="text-[13px] text-slate-500">
              Noch keine Aufrufe erfasst. Die Zählung beginnt mit dem nächsten
              Deployment.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {topPfade.map(([pfad, n]) => (
                <li key={pfad} className="text-[13px]">
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="text-slate-700">{label(pfad)}</span>
                    <span className="font-semibold text-slate-500">{n}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full rounded bg-primary"
                      style={{ width: `${Math.round((n / maxPfad) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Kennzahl({
  label,
  wert,
  ton = "neutral",
}: {
  label: string;
  wert: number;
  ton?: "neutral" | "ok" | "warn";
}) {
  const farbe =
    ton === "warn"
      ? "text-amber-600"
      : ton === "ok"
      ? "text-emerald-600"
      : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
      <div className={`text-[22px] font-bold leading-none ${farbe}`}>{wert}</div>
      <div className="mt-1 text-[11px] text-slate-500">{label}</div>
    </div>
  );
}
