import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTeams, loadMatrix } from "@/lib/matrix";
import MatrixShell from "@/components/MatrixShell";

export const dynamic = "force-dynamic";

export default async function MatrixPage({
  searchParams,
}: {
  searchParams: { team?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profil } = await supabase
    .from("benutzer")
    .select("spieler_id, rollen")
    .eq("id", user.id)
    .maybeSingle();

  let isMf = false;
  if (profil?.spieler_id) {
    const { data: sp } = await supabase
      .from("spieler")
      .select("dsgvo_einwilligung_am")
      .eq("id", profil.spieler_id)
      .maybeSingle();
    if (sp && !sp.dsgvo_einwilligung_am) redirect("/einwilligung");
    const { data: mt } = await supabase
      .from("mannschaften")
      .select("id")
      .or(
        `mannschaftsfuehrer_id.eq.${profil.spieler_id},stellv_mf_id.eq.${profil.spieler_id}`
      );
    isMf = (mt ?? []).length > 0;
  }

  const teams = await loadTeams(supabase);
  if (teams.length === 0) redirect("/");

  const selectedTeamId =
    teams.find((t) => t.id === searchParams.team)?.id ?? teams[0].id;
  const matrix = await loadMatrix(supabase, selectedTeamId);
  const rollen: string[] = (profil?.rollen as string[] | null) ?? [];

  return (
    <MatrixShell
      teams={teams}
      matrix={matrix}
      selectedTeamId={selectedTeamId}
      userEmail={user.email ?? ""}
      rollen={rollen}
      isMf={isMf}
      basePath="/matrix"
    />
  );
}
