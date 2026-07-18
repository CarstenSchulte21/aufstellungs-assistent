import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { loadLagebild } from "@/lib/lagebild";
import { loadInbox } from "@/lib/inbox";
import { loadSpielerAufgaben } from "@/lib/spielerinbox";
import AppHeader from "@/components/AppHeader";
import UebersichtTeams from "./UebersichtTeams";

export const dynamic = "force-dynamic";

function fmt(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

export default async function Uebersicht() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // DSGVO-Gate
  if (session.spielerId) {
    const { data: sp } = await supabase
      .from("spieler")
      .select("dsgvo_einwilligung_am")
      .eq("id", session.spielerId)
      .maybeSingle();
    if (sp && !sp.dsgvo_einwilligung_am) redirect("/einwilligung");
  }

  // Onboarding-Gate: beim ersten Login den Willkommensscreen zeigen
  const { data: prof } = await supabase
    .from("benutzer")
    .select("onboarding_gesehen")
    .eq("id", session.userId)
    .maybeSingle();
  if (prof && prof.onboarding_gesehen === false) redirect("/willkommen");

  const { teams, luecken, doppelzusagen } = await loadLagebild(supabase);
  const inboxCount =
    session.isAdmin || session.isMf
      ? (await loadInbox(supabase, { isAdmin: session.isAdmin, mfTeams: session.mfTeams, schnell: true })).length
      : 0;
  const spielerCount = session.spielerId
    ? (await loadSpielerAufgaben(supabase, session.spielerId)).length
    : 0;

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
        inboxCount={inboxCount}
        spielerCount={spielerCount}
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <UebersichtTeams teams={teams} />

        {/* Konflikte / Lücken */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-[14px] font-bold text-slate-800">
              Lücken vereinsweit ({luecken.length})
            </h2>
            {luecken.length === 0 ? (
              <p className="text-[13px] text-slate-500">
                Aktuell keine offenen Lücken. 👍
              </p>
            ) : (
              <div className="space-y-1.5">
                {luecken.slice(0, 12).map((l) => (
                  <a
                    key={l.spielId}
                    href={`/spieltag/${l.spielId}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-[13px] hover:border-amber-300"
                  >
                    <span className="font-medium text-slate-800">
                      {l.teamName}
                    </span>
                    <span className="text-slate-500">
                      {fmt(l.datum)} · gegen {l.gegner}
                    </span>
                    <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-700">
                      {l.zu}/{l.benoetigt}
                    </span>
                    <span
                      className={`text-[11px] ${
                        l.tageBis <= 7 ? "font-bold text-rose-600" : "text-slate-400"
                      }`}
                    >
                      in {l.tageBis} T.
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-[14px] font-bold text-slate-800">
              Doppelzusagen am selben Tag ({doppelzusagen.length})
            </h2>
            {doppelzusagen.length === 0 ? (
              <p className="text-[13px] text-slate-500">Keine Konflikte.</p>
            ) : (
              <div className="space-y-1.5">
                {doppelzusagen.map((d, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2 text-[13px]"
                  >
                    <span className="font-medium text-slate-800">
                      {d.spielerName}
                    </span>{" "}
                    <span className="text-slate-500">am {fmt(d.datum)}:</span>{" "}
                    <span className="font-medium text-rose-600">
                      {d.teams.join(" + ")}
                    </span>
                    <div className="text-[11px] text-slate-500">
                      Bitte zwischen den Mannschaftsführern klären.
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
