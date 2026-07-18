import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { loadTeams, loadMatrix } from "@/lib/matrix";
import MatrixShell from "@/components/MatrixShell";

export const dynamic = "force-dynamic";

export default async function MannschaftPage({
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

  const alle = await loadTeams(supabase);
  let meine = alle.filter((t) => session.mfTeams.includes(t.id));

  // Spieler ohne MF-Rolle: die eigene Stamm-Mannschaft (schreibgeschützt)
  if (meine.length === 0 && session.spielerId) {
    const { data: hs } = await supabase
      .from("halbserien")
      .select("id")
      .eq("aktiv", true)
      .maybeSingle();
    const { data: stamm } = await supabase
      .from("kader_zuordnung")
      .select("mannschaft_id")
      .eq("spieler_id", session.spielerId)
      .eq("halbserie_id", hs?.id ?? "")
      .eq("rolle", "stamm")
      .maybeSingle();
    if (stamm?.mannschaft_id) {
      meine = alle.filter((t) => t.id === stamm.mannschaft_id);
    }
  }

  if (meine.length === 0) {
    return (
      <main className="min-h-screen bg-slate-50">
        <header className="bg-primary text-white">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
            <a href="/" className="text-blue-100 hover:text-white">
              ←
            </a>
            <div className="mr-auto text-[15px] font-bold">Meine Mannschaft</div>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Dir ist aktuell keine Stamm-Mannschaft zugeordnet. Sobald dich dein
            Mannschaftsführer in den Kader aufgenommen hat, erscheint hier deine
            Mannschaft.
          </div>
        </div>
      </main>
    );
  }

  const selectedTeamId =
    meine.find((t) => t.id === searchParams.team)?.id ?? meine[0].id;
  const matrix = await loadMatrix(supabase, selectedTeamId);

  return (
    <MatrixShell
      teams={meine}
      matrix={matrix}
      selectedTeamId={selectedTeamId}
      userEmail={user?.email ?? ""}
      isAdmin={session.isAdmin}
      isMf={session.isMf}
      realIsAdmin={session.realIsAdmin}
      realIsMf={session.realIsMf}
      hatManagement={session.hatManagement}
      modus={session.modus}
      basePath="/mannschaft"
    />
  );
}
