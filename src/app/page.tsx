import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadTeams, loadMatrix } from "@/lib/matrix";
import MatrixShell from "@/components/MatrixShell";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: { team?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Profil + Rollen
  const { data: profil } = await supabase
    .from("benutzer")
    .select("spieler_id, rollen")
    .eq("id", user.id)
    .maybeSingle();

  // DSGVO-Gate: verknüpfte Spieler ohne Einwilligung zuerst einwilligen lassen
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

  if (teams.length === 0) {
    return (
      <EmptyLayout email={user.email ?? ""}>
        <p className="font-medium text-slate-700">Noch keine Daten vorhanden.</p>
        <p className="mt-1 text-sm text-slate-500">
          Es sind noch keine Mannschaften angelegt. Sobald Spielplan und Meldung
          erfasst sind, erscheint hier die Saison-Matrix.
        </p>
      </EmptyLayout>
    );
  }

  const requested = searchParams.team;
  const selectedTeamId =
    teams.find((t) => t.id === requested)?.id ?? teams[0].id;

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
    />
  );
}

function EmptyLayout({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-lg">
            🏓
          </div>
          <div className="mr-auto text-[15px] font-bold">Aufstellungs-Assistent</div>
          <span className="text-[12px] text-blue-200">{email}</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </div>
      </div>
    </main>
  );
}
