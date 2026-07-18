import type { SupabaseClient } from "@supabase/supabase-js";
import { heuteBerlin } from "@/lib/cron";

export type InboxItem = {
  typ:
    | "luecke"
    | "einplanen"
    | "abgelaufen"
    | "keine_antwort"
    | "unsicher"
    | "konflikt";
  titel: string;
  detail: string;
  datum: string;
  teamName: string;
  spielId: string;
  ersatzanfrageId?: string;
};

export async function loadInbox(
  supabase: SupabaseClient,
  opts: { isAdmin: boolean; mfTeams: string[] }
): Promise<InboxItem[]> {
  const heute = heuteBerlin();
  const { data: hs } = await supabase
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();
  const halbserieId = hs?.id ?? "";

  const { data: teams } = await supabase
    .from("mannschaften")
    .select("id, name, spielstaerke");
  const nameVon = new Map<string, string>();
  const staerkeVon = new Map<string, number>();
  for (const t of teams ?? []) {
    nameVon.set((t as any).id, (t as any).name);
    staerkeVon.set((t as any).id, (t as any).spielstaerke);
  }
  const meineTeamIds = opts.isAdmin
    ? Array.from(nameVon.keys())
    : opts.mfTeams;
  if (meineTeamIds.length === 0) return [];

  const { data: spiele } = await supabase
    .from("spiele")
    .select("id, datum, heim, gegner, mannschaft_id")
    .eq("halbserie_id", halbserieId)
    .in("mannschaft_id", meineTeamIds)
    .gte("datum", heute)
    .order("datum", { ascending: true });
  const spielIds = (spiele ?? []).map((s: any) => s.id);
  if (spielIds.length === 0) return [];

  const { data: verf } = await supabase
    .from("verfuegbarkeiten")
    .select("spiel_id, status")
    .in("spiel_id", spielIds);
  const zuVon = new Map<string, number>();
  const kaVon = new Map<string, number>();
  const unVon = new Map<string, number>();
  for (const v of verf ?? []) {
    const id = (v as any).spiel_id;
    const st = (v as any).status;
    if (st === "zugesagt") zuVon.set(id, (zuVon.get(id) ?? 0) + 1);
    else if (st === "keine_antwort") kaVon.set(id, (kaVon.get(id) ?? 0) + 1);
    else if (st === "unsicher") unVon.set(id, (unVon.get(id) ?? 0) + 1);
  }

  const { data: ers } = await supabase
    .from("ersatzanfragen")
    .select("id, spiel_id, status, spieler:spieler_id(name)")
    .in("spiel_id", spielIds)
    .in("status", ["zugesagt", "abgelaufen"]);

  const items: InboxItem[] = [];
  for (const s of spiele ?? []) {
    const teamName = nameVon.get((s as any).mannschaft_id) ?? "";
    const benoetigt = staerkeVon.get((s as any).mannschaft_id) ?? 0;
    const zu = zuVon.get((s as any).id) ?? 0;
    const gemein = { datum: (s as any).datum, teamName, spielId: (s as any).id };
    if (zu < benoetigt) {
      items.push({
        typ: "luecke",
        titel: `${benoetigt - zu} Lücke${benoetigt - zu > 1 ? "n" : ""}`,
        detail: `${teamName} · ${(s as any).heim ? "Heim" : "Auswärts"} gegen ${
          (s as any).gegner
        } (${zu}/${benoetigt})`,
        ...gemein,
      });
    }
    const ka = kaVon.get((s as any).id) ?? 0;
    if (ka > 0)
      items.push({
        typ: "keine_antwort",
        titel: `${ka}× keine Antwort`,
        detail: `${teamName} gegen ${(s as any).gegner} — erneut anfragen oder manuell setzen`,
        ...gemein,
      });
    const un = unVon.get((s as any).id) ?? 0;
    if (un > 0)
      items.push({
        typ: "unsicher",
        titel: `${un} unsichere Zusage${un > 1 ? "n" : ""}`,
        detail: `${teamName} gegen ${(s as any).gegner} — nachfassen`,
        ...gemein,
      });
  }

  const spielById = new Map<string, any>((spiele ?? []).map((s: any) => [s.id, s]));
  for (const a of ers ?? []) {
    const s = spielById.get((a as any).spiel_id);
    if (!s) continue;
    const teamName = nameVon.get(s.mannschaft_id) ?? "";
    if ((a as any).status === "zugesagt")
      items.push({
        typ: "einplanen",
        titel: `${(a as any).spieler?.name ?? "Ersatz"} hat zugesagt`,
        detail: `${teamName} gegen ${s.gegner} — final einplanen`,
        datum: s.datum,
        teamName,
        spielId: s.id,
        ersatzanfrageId: (a as any).id,
      });
    else
      items.push({
        typ: "abgelaufen",
        titel: `Anfrage an ${(a as any).spieler?.name ?? "Ersatz"} abgelaufen`,
        detail: `${teamName} gegen ${s.gegner} — nächsten Kandidaten anfragen`,
        datum: s.datum,
        teamName,
        spielId: s.id,
        ersatzanfrageId: (a as any).id,
      });
  }

  // Doppelzusagen, die eine meiner Mannschaften betreffen
  const { data: meineZus } = await supabase
    .from("verfuegbarkeiten")
    .select("spiel_id, spieler_id")
    .in("spiel_id", spielIds)
    .eq("status", "zugesagt");
  const meineZusList = (meineZus ?? [])
    .map((v: any) => ({ spieler_id: v.spieler_id, spiel: spielById.get(v.spiel_id) }))
    .filter((x: any) => x.spiel);
  const dates = Array.from(new Set(meineZusList.map((x: any) => x.spiel.datum)));

  if (dates.length > 0) {
    const { data: tagSpiele } = await supabase
      .from("spiele")
      .select("id, datum, mannschaft_id")
      .eq("halbserie_id", halbserieId)
      .in("datum", dates as string[]);
    const teamVonSpiel = new Map<string, { datum: string; team: string }>(
      (tagSpiele ?? []).map((s: any) => [s.id, { datum: s.datum, team: s.mannschaft_id }])
    );
    const { data: tagZus } = await supabase
      .from("verfuegbarkeiten")
      .select("spiel_id, spieler_id")
      .in("spiel_id", (tagSpiele ?? []).map((s: any) => s.id))
      .eq("status", "zugesagt");
    const teamsProSpielerTag = new Map<string, Set<string>>();
    for (const v of tagZus ?? []) {
      const info = teamVonSpiel.get((v as any).spiel_id);
      if (!info) continue;
      const key = `${(v as any).spieler_id}|${info.datum}`;
      const set = teamsProSpielerTag.get(key) ?? new Set<string>();
      set.add(info.team);
      teamsProSpielerTag.set(key, set);
    }

    const konfliktIds = new Set<string>();
    const konflikte: {
      spieler_id: string;
      datum: string;
      spielId: string;
      teamId: string;
      andere: string[];
    }[] = [];
    const gesehen = new Set<string>();
    for (const z of meineZusList as any[]) {
      const key = `${z.spieler_id}|${z.spiel.datum}`;
      const set = teamsProSpielerTag.get(key);
      if (set && set.size >= 2) {
        const dedupe = `${z.spieler_id}|${z.spiel.id}`;
        if (gesehen.has(dedupe)) continue;
        gesehen.add(dedupe);
        konfliktIds.add(z.spieler_id);
        konflikte.push({
          spieler_id: z.spieler_id,
          datum: z.spiel.datum,
          spielId: z.spiel.id,
          teamId: z.spiel.mannschaft_id,
          andere: Array.from(set)
            .filter((t) => t !== z.spiel.mannschaft_id)
            .map((t) => nameVon.get(t) ?? ""),
        });
      }
    }

    const namen = new Map<string, string>();
    if (konfliktIds.size > 0) {
      const { data: sp } = await supabase
        .from("spieler")
        .select("id, name")
        .in("id", Array.from(konfliktIds));
      for (const s of sp ?? []) namen.set((s as any).id, (s as any).name);
    }
    for (const k of konflikte) {
      items.push({
        typ: "konflikt",
        titel: `Doppelzusage: ${namen.get(k.spieler_id) ?? "Spieler"}`,
        detail: `${nameVon.get(k.teamId) ?? ""} — hat am selben Tag auch bei ${k.andere.join(
          ", "
        )} zugesagt. Bitte mit dem/den anderen MF klären.`,
        datum: k.datum,
        teamName: nameVon.get(k.teamId) ?? "",
        spielId: k.spielId,
      });
    }
  }

  items.sort((a, b) => a.datum.localeCompare(b.datum));
  return items;
}
