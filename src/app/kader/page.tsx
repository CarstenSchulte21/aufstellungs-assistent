import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import KaderClient, { type KaderPlayer, type TeamOpt } from "./KaderClient";

export const dynamic = "force-dynamic";

export default async function KaderPage({
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

  // Verwaltbare Mannschaften
  const { data: alleTeams } = await supabase
    .from("mannschaften")
    .select("id, nummer, name")
    .order("nummer");
  const teams: TeamOpt[] = (alleTeams ?? [])
    .filter((t: any) => session.isAdmin || session.mfTeams.includes(t.id))
    .map((t: any) => ({ id: t.id, nummer: t.nummer, name: t.name }));

  const selectedTeamId =
    teams.find((t) => t.id === searchParams.team)?.id ?? teams[0]?.id ?? "";

  // Kader der gewählten Mannschaft
  const { data: meld } = await supabase
    .from("meldungen")
    .select(
      "position, spieler:spieler_id(id, name, qttr, kanal, telefon, email, praeferenzen, proxy_spieler_id)"
    )
    .eq("mannschaft_id", selectedTeamId)
    .eq("halbserie_id", halbserieId)
    .order("position");

  const { data: kader } = await supabase
    .from("kader_status")
    .select("spieler_id, status, pausiert_bis, notiz")
    .eq("halbserie_id", halbserieId);
  const kaderMap = new Map((kader ?? []).map((k: any) => [k.spieler_id, k]));

  // Offene Abfragen je Spieler (künftige Spiele) für den Konsequenz-Dialog
  const heute = new Date().toISOString().slice(0, 10);
  const { data: spiele } = await supabase
    .from("spiele")
    .select("id")
    .eq("mannschaft_id", selectedTeamId)
    .eq("halbserie_id", halbserieId)
    .gte("datum", heute);
  const spielIds = (spiele ?? []).map((s: any) => s.id);
  const offenMap = new Map<string, number>();
  if (spielIds.length > 0) {
    const { data: verf } = await supabase
      .from("verfuegbarkeiten")
      .select("spieler_id, status")
      .in("spiel_id", spielIds)
      .in("status", ["angefragt", "erinnert"]);
    for (const v of verf ?? []) {
      offenMap.set(
        (v as any).spieler_id,
        (offenMap.get((v as any).spieler_id) ?? 0) + 1
      );
    }
  }

  const players: KaderPlayer[] = (meld ?? []).map((m: any) => {
    const k = kaderMap.get(m.spieler?.id) as any;
    return {
      id: m.spieler?.id,
      name: m.spieler?.name ?? "—",
      position: m.position,
      qttr: m.spieler?.qttr ?? 0,
      kanal: m.spieler?.kanal ?? "telegram",
      telefon: m.spieler?.telefon ?? "",
      email: m.spieler?.email ?? "",
      praeferenzen: m.spieler?.praeferenzen ?? {},
      proxy_spieler_id: m.spieler?.proxy_spieler_id ?? null,
      status: k?.status ?? "aktiv",
      pausiert_bis: k?.pausiert_bis ?? null,
      notiz: k?.notiz ?? "",
      offeneAbfragen: offenMap.get(m.spieler?.id) ?? 0,
    };
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <a href="/" className="text-blue-100 hover:text-white">
            ←
          </a>
          <div className="mr-auto text-[15px] font-bold">Kader kuratieren</div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {teams.map((t) => (
            <a
              key={t.id}
              href={`/kader?team=${t.id}`}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                t.id === selectedTeamId
                  ? "border-primary bg-primary text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {t.name}
            </a>
          ))}
        </div>
        <KaderClient
          halbserieId={halbserieId}
          players={players}
          teamMembers={players.map((p) => ({ id: p.id, name: p.name }))}
        />
      </main>
    </div>
  );
}
