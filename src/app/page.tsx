import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { loadLagebild } from "@/lib/lagebild";
import { loadInbox } from "@/lib/inbox";
import { loadSpielerAufgaben } from "@/lib/spielerinbox";
import AppHeader from "@/components/AppHeader";
import UebersichtTeams from "./UebersichtTeams";
import { InboxAufgaben, SpielerAufgabenListe } from "./UebersichtAufgaben";

export const dynamic = "force-dynamic";

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

  const { teams } = await loadLagebild(supabase);

  // Aufgaben je nach aktivem Modus: Management → Inbox, sonst Spieler-To-dos
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
        <UebersichtTeams teams={teams} />
        {management ? (
          <InboxAufgaben items={inboxItems} />
        ) : (
          session.spielerId && <SpielerAufgabenListe items={spielerItems} />
        )}
      </main>
    </div>
  );
}
