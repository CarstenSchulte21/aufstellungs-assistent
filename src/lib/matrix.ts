import type { SupabaseClient } from "@supabase/supabase-js";

export type TeamRow = {
  id: string;
  nummer: number;
  name: string;
  liga: string | null;
  spielstaerke: number;
};

export type KaderStatus = "aktiv" | "pausiert" | "inaktiv";

export type RosterPlayer = {
  spieler_id: string;
  name: string;
  qttr: number;
  position: number;
  res: boolean;
  kader_status: KaderStatus;
  ersatzHerkunft?: number | null; // Herkunfts-Mannschaft, wenn Ersatzspieler
  favorit?: boolean; // Favorit statt Stamm
  gemeldetInNummer?: number | null; // Meldemannschaft, falls abweichend
};

export type Day = {
  id: string;
  spieltag_nr: number;
  datum: string;
  uhrzeit: string | null;
  heim: boolean;
  gegner: string;
  status: string;
};

export type Cell = {
  status: string;
  kommentar: string | null;
  quelle: string;
  updated_at: string;
  eingetragen_von: string | null;
};

export type MatrixData = {
  team: TeamRow;
  days: Day[];
  roster: RosterPlayer[];
  cells: Record<string, Cell>; // key: `${spiel_id}:${spieler_id}`
};

export async function loadTeams(
  supabase: SupabaseClient
): Promise<TeamRow[]> {
  const { data } = await supabase
    .from("mannschaften")
    .select("id, nummer, name, liga, spielstaerke")
    .order("nummer", { ascending: true });
  return (data ?? []) as TeamRow[];
}

async function activeHalbserieId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();
  return data?.id ?? null;
}

export async function loadMatrix(
  supabase: SupabaseClient,
  teamId: string
): Promise<MatrixData | null> {
  const halbserieId = await activeHalbserieId(supabase);
  if (!halbserieId) return null;

  const { data: team } = await supabase
    .from("mannschaften")
    .select("id, nummer, name, liga, spielstaerke")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return null;

  const teamNummer = (team as any).nummer ?? 0;

  // Operativer Kader: Stamm + Favoriten (kader_zuordnung), nicht die Meldung.
  const { data: zuord } = await supabase
    .from("kader_zuordnung")
    .select("spieler_id, rolle")
    .eq("mannschaft_id", teamId)
    .eq("halbserie_id", halbserieId);
  const stammIds: string[] = (zuord ?? [])
    .filter((z: any) => z.rolle === "stamm")
    .map((z: any) => z.spieler_id);
  const favoritIds: string[] = (zuord ?? [])
    .filter((z: any) => z.rolle === "favorit")
    .map((z: any) => z.spieler_id);
  const alleIds = [...stammIds, ...favoritIds];

  // Spielerstammdaten
  const { data: spielerRows } = alleIds.length
    ? await supabase.from("spieler").select("id, name, qttr").in("id", alleIds)
    : { data: [] as any[] };
  const spInfo = new Map<string, { name: string; qttr: number }>(
    (spielerRows ?? []).map((s: any) => [s.id, { name: s.name, qttr: s.qttr }])
  );

  // Meldungs-Info (Position, RES, Meldemannschaft) für Anzeige
  const { data: meldRows } = alleIds.length
    ? await supabase
        .from("meldungen")
        .select("spieler_id, position, res, mannschaften:mannschaft_id(nummer)")
        .eq("halbserie_id", halbserieId)
        .in("spieler_id", alleIds)
    : { data: [] as any[] };
  const meldInfo = new Map<
    string,
    { position: number; res: boolean; nummer: number }
  >(
    (meldRows ?? []).map((m: any) => [
      m.spieler_id,
      { position: m.position ?? 0, res: !!m.res, nummer: m.mannschaften?.nummer ?? 0 },
    ])
  );

  // Operativer Kader-Status je Spieler
  const { data: kader } = await supabase
    .from("kader_status")
    .select("spieler_id, status")
    .eq("halbserie_id", halbserieId);
  const statusMap = new Map<string, KaderStatus>(
    (kader ?? []).map((k: any) => [k.spieler_id, k.status])
  );

  const stammRoster: RosterPlayer[] = stammIds.map((id: string) => {
    const mi = meldInfo.get(id);
    const gemeldetHier = mi?.nummer === teamNummer;
    return {
      spieler_id: id,
      name: spInfo.get(id)?.name ?? "—",
      qttr: spInfo.get(id)?.qttr ?? 0,
      position: gemeldetHier ? mi?.position ?? 0 : 0,
      res: mi?.res ?? false,
      kader_status: statusMap.get(id) ?? "aktiv",
      gemeldetInNummer: mi && !gemeldetHier ? mi.nummer : null,
    };
  });
  stammRoster.sort((a, b) => {
    const ah = a.gemeldetInNummer == null;
    const bh = b.gemeldetInNummer == null;
    if (ah !== bh) return ah ? -1 : 1;
    if (ah && bh) return a.position - b.position;
    return b.qttr - a.qttr;
  });

  const favoritRoster: RosterPlayer[] = favoritIds
    .map((id: string) => {
      const mi = meldInfo.get(id);
      return {
        spieler_id: id,
        name: spInfo.get(id)?.name ?? "—",
        qttr: spInfo.get(id)?.qttr ?? 0,
        position: 800,
        res: false,
        kader_status: statusMap.get(id) ?? "aktiv",
        favorit: true,
        gemeldetInNummer: mi && mi.nummer !== teamNummer ? mi.nummer : null,
      };
    })
    .sort((a, b) => b.qttr - a.qttr);

  const roster: RosterPlayer[] = [...stammRoster, ...favoritRoster];

  // Spieltage
  const { data: spiele } = await supabase
    .from("spiele")
    .select("id, spieltag_nr, datum, uhrzeit, heim, gegner, status")
    .eq("mannschaft_id", teamId)
    .eq("halbserie_id", halbserieId)
    .order("datum", { ascending: true });
  const days = (spiele ?? []) as Day[];

  // Verfügbarkeiten (über die maskierte View)
  const cells: Record<string, Cell> = {};
  const spielIds = days.map((d) => d.id);
  if (spielIds.length > 0) {
    const { data: verf } = await supabase
      .from("v_verfuegbarkeiten")
      .select("spiel_id, spieler_id, status, kommentar, quelle, updated_at, eingetragen_von")
      .in("spiel_id", spielIds);
    for (const v of verf ?? []) {
      cells[`${(v as any).spiel_id}:${(v as any).spieler_id}`] = {
        status: (v as any).status,
        kommentar: (v as any).kommentar,
        quelle: (v as any).quelle,
        updated_at: (v as any).updated_at,
        eingetragen_von: (v as any).eingetragen_von,
      };
    }
  }

  // Ersatzspieler ergänzen: Spieler mit Verfügbarkeit für ein Spiel dieser
  // Mannschaft, die aber nicht in ihrer Meldung stehen (Aushilfe von unten).
  const rosterIds = new Set(roster.map((r) => r.spieler_id));
  const ersatzIds = new Set<string>();
  for (const key of Object.keys(cells)) {
    const sid = key.split(":")[1];
    if (!rosterIds.has(sid)) ersatzIds.add(sid);
  }
  if (ersatzIds.size > 0) {
    const { data: extra } = await supabase
      .from("meldungen")
      .select("spieler_id, mannschaften:mannschaft_id(nummer), spieler:spieler_id(name, qttr)")
      .eq("halbserie_id", halbserieId)
      .in("spieler_id", Array.from(ersatzIds));
    for (const m of extra ?? []) {
      const herkunft = (m as any).mannschaften?.nummer ?? null;
      roster.push({
        spieler_id: (m as any).spieler_id,
        name: (m as any).spieler?.name ?? "—",
        qttr: (m as any).spieler?.qttr ?? 0,
        position: 900 + (herkunft ?? 0), // Ersatz ans Ende sortieren
        res: false,
        kader_status: statusMap.get((m as any).spieler_id) ?? "aktiv",
        ersatzHerkunft: herkunft,
      });
    }
  }

  return { team: team as TeamRow, days, roster, cells };
}
