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
  const meine = alle.filter((t) => session.mfTeams.includes(t.id));

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
            Du bist aktuell keiner Mannschaft als Mannschaftsführer oder
            Stellvertreter zugeordnet. Der Admin kann das unter „Verwaltung →
            Mannschaftsführung“ einstellen.
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
      spielerModus={session.spielerModus}
      basePath="/mannschaft"
    />
  );
}
