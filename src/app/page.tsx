import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { loadInbox } from "@/lib/inbox";
import { loadSpielerAufgaben } from "@/lib/spielerinbox";
import { loadSpielerInfos } from "@/lib/spielerinfos";
import { loadTeams, loadMatrix } from "@/lib/matrix";
import { ladeStammTeamId } from "@/lib/kader";
import AppHeader from "@/components/AppHeader";
import TeamMatrixBereich from "./TeamMatrixBereich";
import {
  InboxAufgaben,
  SpielerAufgabenListe,
  SpielerInfoListe,
} from "./UebersichtAufgaben";

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
  const spielerInfos =
    !management && session.spielerId
      ? await loadSpielerInfos(supabase, session.spielerId)
      : [];
  const spielerCount = session.spielerId
    ? management
      ? (await loadSpielerAufgaben(supabase, session.spielerId)).length
      : spielerItems.length
    : 0;

  // Team-Slider über ALLE Mannschaften, Start bei der eigenen.
  const alle = await loadTeams(supabase); // aufsteigend nach Nummer
  const hsId = (await aktiveHalbserie(supabase)) ?? "";
  let ownTeamId: string | null = null;
  if (session.spielerId) {
    ownTeamId = await ladeStammTeamId(supabase, hsId, session.spielerId);
    if (!ownTeamId) {
      const { data: mfrows } = await supabase
        .from("mannschaften")
        .select("id, nummer")
        .or(
          `mannschaftsfuehrer_id.eq.${session.spielerId},stellv_mf_id.eq.${session.spielerId}`
        )
        .order("nummer");
      ownTeamId = (mfrows?.[0] as any)?.id ?? null;
    }
  }
  if (!ownTeamId) ownTeamId = alle[0]?.id ?? null;

  const selectedTeamId =
    alle.find((t) => t.id === searchParams.team)?.id ?? ownTeamId ?? "";
  const matrix = selectedTeamId ? await loadMatrix(supabase, selectedTeamId) : null;

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
        {selectedTeamId ? (
          <TeamMatrixBereich
            teams={alle}
            initialMatrix={matrix}
            initialTeamId={selectedTeamId}
            ownTeamId={ownTeamId}
          />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Noch keine Mannschaften angelegt.
          </div>
        )}
        {management ? (
          <InboxAufgaben items={inboxItems} />
        ) : (
          session.spielerId && (
            <>
              <SpielerAufgabenListe items={spielerItems} />
              <SpielerInfoListe items={spielerInfos} />
            </>
          )
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
