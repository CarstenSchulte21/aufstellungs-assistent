import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import KaderClient, { type KaderPlayer, type TeamOpt } from "./KaderClient";
import KaderZuordnung, {
  type FavoritRow,
  type KandidatRow,
} from "./KaderZuordnung";

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

  // Meldungs-Info je Spieler (Team + Position) — für Badges „gemeldet in X"
  const { data: meldAll } = await supabase
    .from("meldungen")
    .select("spieler_id, position, mannschaften:mannschaft_id(name)")
    .eq("halbserie_id", halbserieId);
  const meldInfo = new Map<string, { teamName: string; position: number }>();
  for (const m of meldAll ?? [])
    meldInfo.set((m as any).spieler_id, {
      teamName: (m as any).mannschaften?.name ?? "",
      position: (m as any).position ?? 0,
    });

  // Aktueller Stamm je Spieler (für die Auswahl-Picker)
  const { data: stammAll } = await supabase
    .from("kader_zuordnung")
    .select("spieler_id, mannschaften:mannschaft_id(name)")
    .eq("halbserie_id", halbserieId)
    .eq("rolle", "stamm");
  const stammTeam = new Map<string, string>();
  for (const s of stammAll ?? [])
    stammTeam.set((s as any).spieler_id, (s as any).mannschaften?.name ?? "");

  // Operativer Kader der gewählten Mannschaft (Stamm + Favorit)
  const { data: zuord } = await supabase
    .from("kader_zuordnung")
    .select("spieler_id, rolle")
    .eq("halbserie_id", halbserieId)
    .eq("mannschaft_id", selectedTeamId);
  const stammIds = (zuord ?? [])
    .filter((z: any) => z.rolle === "stamm")
    .map((z: any) => z.spieler_id);
  const favoritIds = (zuord ?? [])
    .filter((z: any) => z.rolle === "favorit")
    .map((z: any) => z.spieler_id);
  const imTeam = new Set<string>([...stammIds, ...favoritIds]);

  // Stammdaten der Stamm-Spieler
  const { data: stammSpieler } = stammIds.length
    ? await supabase
        .from("spieler")
        .select(
          "id, name, qttr, kanal, telefon, email, praeferenzen, proxy_spieler_id"
        )
        .in("id", stammIds)
    : { data: [] as any[] };

  // Kader-Status (aktiv/pausiert/inaktiv)
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
    for (const v of verf ?? [])
      offenMap.set(
        (v as any).spieler_id,
        (offenMap.get((v as any).spieler_id) ?? 0) + 1
      );
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const selectedTeamName = selectedTeam?.name ?? "";

  const players: KaderPlayer[] = ((stammSpieler ?? []) as any[])
    .map((s: any): KaderPlayer => {
      const k = kaderMap.get(s.id) as any;
      const mi = meldInfo.get(s.id);
      const gemeldetHier = mi?.teamName === selectedTeamName;
      return {
        id: s.id,
        name: s.name ?? "—",
        position: gemeldetHier ? mi?.position ?? 0 : 0,
        gemeldetHier,
        meldungTeamName: mi?.teamName ?? "",
        qttr: s.qttr ?? 0,
        kanal: s.kanal ?? "telegram",
        telefon: s.telefon ?? "",
        email: s.email ?? "",
        praeferenzen: s.praeferenzen ?? {},
        proxy_spieler_id: s.proxy_spieler_id ?? null,
        status: k?.status ?? "aktiv",
        pausiert_bis: k?.pausiert_bis ?? null,
        notiz: k?.notiz ?? "",
        offeneAbfragen: offenMap.get(s.id) ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.gemeldetHier !== b.gemeldetHier) return a.gemeldetHier ? -1 : 1;
      if (a.gemeldetHier && b.gemeldetHier) return a.position - b.position;
      return b.qttr - a.qttr;
    });

  const { data: favSp } = favoritIds.length
    ? await supabase
        .from("spieler")
        .select("id, name, qttr")
        .in("id", favoritIds)
    : { data: [] as any[] };
  const favoriten: FavoritRow[] = ((favSp ?? []) as any[])
    .map((p: any): FavoritRow => ({
      id: p.id,
      name: p.name ?? "—",
      qttr: p.qttr ?? 0,
      meldungTeamName: meldInfo.get(p.id)?.teamName ?? "",
    }))
    .sort((a, b) => (b.qttr ?? 0) - (a.qttr ?? 0));

  // Kandidaten zum Hinzufügen (alle Spieler, die im Team noch nicht drin sind)
  const { data: alleSpieler } = await supabase
    .from("spieler")
    .select("id, name")
    .order("name");
  const kandidaten: KandidatRow[] = (alleSpieler ?? [])
    .filter((p: any) => !imTeam.has(p.id))
    .map((p: any) => ({
      id: p.id,
      name: p.name,
      meldungTeamName: meldInfo.get(p.id)?.teamName ?? "",
      stammTeamName: stammTeam.get(p.id) ?? "",
    }));

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

        <KaderZuordnung
          halbserieId={halbserieId}
          teamId={selectedTeamId}
          teamName={selectedTeamName}
          isAdmin={session.isAdmin}
          favoriten={favoriten}
          kandidaten={kandidaten}
        />
      </main>
    </div>
  );
}
