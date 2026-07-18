import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { loadLagebild } from "@/lib/lagebild";
import { loadInbox } from "@/lib/inbox";
import { loadSpielerAufgaben } from "@/lib/spielerinbox";
import { loadTeams, loadMatrix, type TeamRow } from "@/lib/matrix";
import { ladeStammTeamId } from "@/lib/kader";
import AppHeader from "@/components/AppHeader";
import UebersichtTeams from "./UebersichtTeams";
import MatrixTabelle from "@/components/MatrixTabelle";
import { InboxAufgaben, SpielerAufgabenListe } from "./UebersichtAufgaben";

export const dynamic = "force-dynamic";

export default async function Uebersicht({
  searchParams,
}: {
  searchParams: { team?: string };
}) {
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

  // Onboarding-Gate
  const { data: prof } = await supabase
    .from("benutzer")
    .select("onboarding_gesehen")
    .eq("id", session.userId)
    .maybeSingle();
  if (prof && prof.onboarding_gesehen === false) redirect("/willkommen");

  // Aufgaben je nach aktivem Modus
  const management = session.isAdmin || session.isMf;
  const inboxItems = management
    ? await loadInbox(supabase, {
        isAdmin: session.isAdmin,
        mfTeams: session.mfTeams,
        schnell: true,
      })
    : [];
  const spielerItems =
    !management && session.spielerId
      ? await loadSpielerAufgaben(supabase, session.spielerId)
      : [];
  const spielerCount = session.spielerId
    ? management
      ? (await loadSpielerAufgaben(supabase, session.spielerId)).length
      : spielerItems.length
    : 0;

  // Hauptinhalt: Admin → Spieltagsübersicht aller Mannschaften; MF/Spieler →
  // Matrix der eigenen Mannschaft.
  let hauptinhalt: React.ReactNode;
  if (session.isAdmin) {
    const { teams } = await loadLagebild(supabase);
    hauptinhalt = <UebersichtTeams teams={teams} />;
  } else {
    const alle = await loadTeams(supabase);
    let meine: TeamRow[] = alle.filter((t) => session.mfTeams.includes(t.id));
    if (meine.length === 0 && session.spielerId) {
      const stammTeam = await ladeStammTeamId(
        supabase,
        // aktive Halbserie über loadMatrix/loadTeams-Kontext: hole sie hier
        (await aktiveHalbserie(supabase)) ?? "",
        session.spielerId
      );
      if (stammTeam) meine = alle.filter((t) => t.id === stammTeam);
    }
    const selectedTeamId =
      meine.find((t) => t.id === searchParams.team)?.id ?? meine[0]?.id ?? "";
    const matrix = selectedTeamId
      ? await loadMatrix(supabase, selectedTeamId)
      : null;
    hauptinhalt = selectedTeamId ? (
      <MatrixTabelle
        teams={meine}
        matrix={matrix}
        selectedTeamId={selectedTeamId}
        isAdmin={session.isAdmin}
        isMf={session.isMf}
        basePath="/"
      />
    ) : (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Dir ist aktuell keine Stamm-Mannschaft zugeordnet. Sobald dich dein
        Mannschaftsführer in den Kader aufgenommen hat, erscheint hier deine
        Mannschaft.
      </div>
    );
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
        spielerCount={spielerCount}
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        {hauptinhalt}
        {management ? (
          <InboxAufgaben items={inboxItems} />
        ) : (
          session.spielerId && <SpielerAufgabenListe items={spielerItems} />
        )}
      </main>
    </div>
  );
}

async function aktiveHalbserie(
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  const { data } = await supabase
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();
  return data?.id ?? null;
}
