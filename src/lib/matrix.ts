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

  // Kader (Meldung + Spielerstammdaten), sortiert nach Position
  const { data: meldungen } = await supabase
    .from("meldungen")
    .select("spieler_id, position, res, spieler:spieler_id(name, qttr)")
    .eq("mannschaft_id", teamId)
    .eq("halbserie_id", halbserieId)
    .order("position", { ascending: true });

  // Operativer Kader-Status je Spieler
  const { data: kader } = await supabase
    .from("kader_status")
    .select("spieler_id, status")
    .eq("halbserie_id", halbserieId);
  const statusMap = new Map<string, KaderStatus>(
    (kader ?? []).map((k: any) => [k.spieler_id, k.status])
  );

  const roster: RosterPlayer[] = (meldungen ?? []).map((m: any) => ({
    spieler_id: m.spieler_id,
    name: m.spieler?.name ?? "—",
    qttr: m.spieler?.qttr ?? 0,
    position: m.position,
    res: m.res,
    kader_status: statusMap.get(m.spieler_id) ?? "aktiv",
  }));

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

  return { team: team as TeamRow, days, roster, cells };
}
