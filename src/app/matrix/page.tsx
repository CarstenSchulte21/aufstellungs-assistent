import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { loadTeams, loadMatrix } from "@/lib/matrix";
import MatrixShell from "@/components/MatrixShell";

export const dynamic = "force-dynamic";

export default async function MatrixPage({
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

  if (session.spielerId) {
    const { data: sp } = await supabase
      .from("spieler")
      .select("dsgvo_einwilligung_am")
      .eq("id", session.spielerId)
      .maybeSingle();
    if (sp && !sp.dsgvo_einwilligung_am) redirect("/einwilligung");
  }

  const teams = await loadTeams(supabase);
  if (teams.length === 0) redirect("/");

  const selectedTeamId =
    teams.find((t) => t.id === searchParams.team)?.id ?? teams[0].id;
  const matrix = await loadMatrix(supabase, selectedTeamId);

  return (
    <MatrixShell
      teams={teams}
      matrix={matrix}
      selectedTeamId={selectedTeamId}
      userEmail={user?.email ?? ""}
      isAdmin={session.isAdmin}
      isMf={session.isMf}
      realIsAdmin={session.realIsAdmin}
      viewAs={session.viewAs}
      basePath="/matrix"
    />
  );
}
