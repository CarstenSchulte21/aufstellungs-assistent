import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import RegelnClient, {
  type TeamOpt,
  type SpielOpt,
  type SpielerOpt,
} from "./RegelnClient";

export const dynamic = "force-dynamic";

export default async function RegelnPage({
  searchParams,
}: {
  searchParams: { team?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin && !session.isMf) redirect("/");

  const supabase = createClient();
  const { data: hs } = await supabase
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();
  const halbserieId = hs?.id ?? "";

  const { data: alleTeams } = await supabase
    .from("mannschaften")
    .select("id, nummer, name")
    .order("nummer");
  const teams: TeamOpt[] = (alleTeams ?? [])
    .filter((t: any) => session.isAdmin || session.mfTeams.includes(t.id))
    .map((t: any) => ({ id: t.id, nummer: t.nummer, name: t.name }));

  if (teams.length === 0) {
    return (
      <Shell>
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Du führst aktuell keine Mannschaft. Die Regelkonfiguration ist den
          Mannschaftsführern vorbehalten.
        </div>
      </Shell>
    );
  }

  const selTeam = teams.find((t) => t.id === searchParams.team) ?? teams[0];
  const teamId = selTeam.id;
  const selNummer = selTeam.nummer;

  const { data: cfg } = await supabase
    .from("regel_config")
    .select("config")
    .eq("mannschaft_id", teamId)
    .eq("halbserie_id", halbserieId)
    .maybeSingle();

  const { data: spiele } = await supabase
    .from("spiele")
    .select("id, spieltag_nr, datum, gegner, heim")
    .eq("mannschaft_id", teamId)
    .eq("halbserie_id", halbserieId)
    .order("datum");
  const spielOpts: SpielOpt[] = (spiele ?? []).map((s: any) => ({
    id: s.id,
    label: `ST ${s.spieltag_nr} · ${s.datum} · ${s.heim ? "H" : "A"} vs ${s.gegner}`,
  }));

  const { data: meld } = await supabase
    .from("meldungen")
    .select("spieler_id, mannschaften:mannschaft_id(nummer), spieler:spieler_id(name)")
    .eq("halbserie_id", halbserieId);
  // Nur Spieler, die überhaupt als Ersatz für diese Mannschaft in Frage kommen:
  // aus tieferen Mannschaften (Ersatz immer nur nach oben). Spieler aus höheren
  // oder derselben Mannschaft können nie Ersatz sein und werden nicht gelistet.
  const spielerOpts: SpielerOpt[] = (meld ?? [])
    .map((m: any) => ({
      id: m.spieler_id,
      name: m.spieler?.name ?? "—",
      team: m.mannschaften?.nummer ?? 0,
    }))
    .filter((s: SpielerOpt) => s.team > selNummer)
    .sort((a: SpielerOpt, b: SpielerOpt) => a.team - b.team || a.name.localeCompare(b.name));

  return (
    <Shell teams={teams} teamId={teamId}>
      <RegelnClient
        halbserieId={halbserieId}
        teamId={teamId}
        config={(cfg?.config as Record<string, any>) ?? {}}
        spiele={spielOpts}
        spieler={spielerOpts}
      />
    </Shell>
  );
}

function Shell({
  children,
  teams,
  teamId,
}: {
  children: React.ReactNode;
  teams?: TeamOpt[];
  teamId?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <a href="/" className="text-blue-100 hover:text-white">
            ←
          </a>
          <div className="mr-auto text-[15px] font-bold">Regeln</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">
        {teams && teams.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {teams.map((t) => (
              <a
                key={t.id}
                href={`/regeln?team=${t.id}`}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  t.id === teamId
                    ? "border-primary bg-primary text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {t.name}
              </a>
            ))}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
