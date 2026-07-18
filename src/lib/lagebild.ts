import type { SupabaseClient } from "@supabase/supabase-js";
import { heuteBerlin } from "@/lib/cron";

export type Ansprechpartner = { name: string; telefon: string | null };

export type TeamUebersicht = {
  teamId: string;
  nummer: number;
  name: string;
  benoetigt: number;
  mf: Ansprechpartner | null;
  stellv: Ansprechpartner | null;
  next: {
    spielId: string;
    datum: string;
    heim: boolean;
    gegner: string;
    zu: number;
    abgesagt: number;
  } | null;
};

export type Luecke = {
  spielId: string;
  datum: string;
  teamNummer: number;
  teamName: string;
  gegner: string;
  heim: boolean;
  zu: number;
  benoetigt: number;
  tageBis: number;
};

export type Doppelzusage = {
  spielerName: string;
  datum: string;
  teams: string[];
};

export async function loadLagebild(supabase: SupabaseClient): Promise<{
  teams: TeamUebersicht[];
  luecken: Luecke[];
  doppelzusagen: Doppelzusage[];
}> {
  const heute = heuteBerlin();

  const { data: hs } = await supabase
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();
  const halbserieId = hs?.id ?? "";

  const { data: teams } = await supabase
    .from("mannschaften")
    .select("id, nummer, name, spielstaerke, mannschaftsfuehrer_id, stellv_mf_id")
    .order("nummer");

  // Ansprechpartner (MF + Stellvertreter) je Team auflösen
  const partnerIds = new Set<string>();
  for (const t of teams ?? []) {
    if ((t as any).mannschaftsfuehrer_id) partnerIds.add((t as any).mannschaftsfuehrer_id);
    if ((t as any).stellv_mf_id) partnerIds.add((t as any).stellv_mf_id);
  }
  const partnerVon = new Map<string, Ansprechpartner>();
  if (partnerIds.size > 0) {
    const { data: ps } = await supabase
      .from("spieler")
      .select("id, name, telefon")
      .in("id", Array.from(partnerIds));
    for (const p of ps ?? [])
      partnerVon.set((p as any).id, {
        name: (p as any).name,
        telefon: (p as any).telefon ?? null,
      });
  }

  const { data: spiele } = await supabase
    .from("spiele")
    .select("id, datum, heim, gegner, mannschaft_id")
    .eq("halbserie_id", halbserieId)
    .gte("datum", heute)
    .order("datum", { ascending: true });

  const spielIds = (spiele ?? []).map((s: any) => s.id);
  const zuVon = new Map<string, number>();
  const abVon = new Map<string, number>();
  const zusagen: { spieler_id: string; spiel_id: string }[] = [];
  if (spielIds.length > 0) {
    const { data: verf } = await supabase
      .from("verfuegbarkeiten")
      .select("spiel_id, spieler_id, status")
      .in("spiel_id", spielIds);
    for (const v of verf ?? []) {
      if ((v as any).status === "zugesagt") {
        zuVon.set((v as any).spiel_id, (zuVon.get((v as any).spiel_id) ?? 0) + 1);
        zusagen.push({ spieler_id: (v as any).spieler_id, spiel_id: (v as any).spiel_id });
      } else if ((v as any).status === "abgesagt") {
        abVon.set((v as any).spiel_id, (abVon.get((v as any).spiel_id) ?? 0) + 1);
      }
    }
  }

  const staerkeVon = new Map<string, number>();
  const nameVon = new Map<string, string>();
  const nummerVon = new Map<string, number>();
  for (const t of teams ?? []) {
    staerkeVon.set((t as any).id, (t as any).spielstaerke);
    nameVon.set((t as any).id, (t as any).name);
    nummerVon.set((t as any).id, (t as any).nummer);
  }
  const spielById = new Map<string, any>((spiele ?? []).map((s: any) => [s.id, s]));

  // Übersicht je Mannschaft (nächstes Spiel)
  const uebersicht: TeamUebersicht[] = (teams ?? []).map((t: any) => {
    const naechstes = (spiele ?? []).find((s: any) => s.mannschaft_id === t.id);
    return {
      teamId: t.id,
      nummer: t.nummer,
      name: t.name,
      benoetigt: t.spielstaerke,
      mf: t.mannschaftsfuehrer_id ? partnerVon.get(t.mannschaftsfuehrer_id) ?? null : null,
      stellv: t.stellv_mf_id ? partnerVon.get(t.stellv_mf_id) ?? null : null,
      next: naechstes
        ? {
            spielId: naechstes.id,
            datum: naechstes.datum,
            heim: naechstes.heim,
            gegner: naechstes.gegner,
            zu: zuVon.get(naechstes.id) ?? 0,
            abgesagt: abVon.get(naechstes.id) ?? 0,
          }
        : null,
    };
  });

  // Lücken vereinsweit (nach Dringlichkeit)
  const heuteMs = new Date(heute + "T00:00:00Z").getTime();
  const luecken: Luecke[] = [];
  for (const s of (spiele ?? []) as any[]) {
    const benoetigt = staerkeVon.get(s.mannschaft_id) ?? 0;
    const zu = zuVon.get(s.id) ?? 0;
    if (zu >= benoetigt) continue;
    luecken.push({
      spielId: s.id,
      datum: s.datum,
      teamNummer: nummerVon.get(s.mannschaft_id) ?? 0,
      teamName: nameVon.get(s.mannschaft_id) ?? "",
      gegner: s.gegner,
      heim: s.heim,
      zu,
      benoetigt,
      tageBis: Math.round(
        (new Date(s.datum + "T00:00:00Z").getTime() - heuteMs) / 86400000
      ),
    });
  }
  luecken.sort((a, b) => a.datum.localeCompare(b.datum));

  // Doppelzusagen: derselbe Spieler am selben Tag für ≥2 Mannschaften zugesagt
  const proSpielerTag = new Map<string, Set<string>>(); // key spieler|datum -> teamnamen
  for (const z of zusagen) {
    const spiel = spielById.get(z.spiel_id);
    if (!spiel) continue;
    const key = `${z.spieler_id}|${spiel.datum}`;
    const set = proSpielerTag.get(key) ?? new Set<string>();
    set.add(nameVon.get(spiel.mannschaft_id) ?? "");
    proSpielerTag.set(key, set);
  }
  const konfliktSpielerIds = new Set<string>();
  const rohKonflikte: { spieler_id: string; datum: string; teams: string[] }[] = [];
  for (const [key, set] of Array.from(proSpielerTag.entries())) {
    if (set.size >= 2) {
      const [spieler_id, datum] = key.split("|");
      konfliktSpielerIds.add(spieler_id);
      rohKonflikte.push({ spieler_id, datum, teams: Array.from(set) });
    }
  }
  const namen = new Map<string, string>();
  if (konfliktSpielerIds.size > 0) {
    const { data: sp } = await supabase
      .from("spieler")
      .select("id, name")
      .in("id", Array.from(konfliktSpielerIds));
    for (const s of sp ?? []) namen.set((s as any).id, (s as any).name);
  }
  const doppelzusagen: Doppelzusage[] = rohKonflikte
    .map((k) => ({
      spielerName: namen.get(k.spieler_id) ?? "—",
      datum: k.datum,
      teams: k.teams,
    }))
    .sort((a, b) => a.datum.localeCompare(b.datum));

  return { teams: uebersicht, luecken, doppelzusagen };
}
