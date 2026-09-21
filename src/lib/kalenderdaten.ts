import type { SupabaseClient } from "@supabase/supabase-js";
import { ladeStammTeamId } from "@/lib/kader";
import type { KalenderEvent } from "@/lib/ical";

// Lädt Spieltage aus der DB und formt sie in Kalender-Events. Abgesetzte Spiele
// werden nicht in den Kalender übernommen (sie finden nicht statt).

async function aktiveHalbserie(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data } = await supabase
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();
  return data?.id ?? null;
}

type SpielRow = {
  id: string;
  spieltag_nr: number;
  datum: string;
  uhrzeit: string | null;
  heim: boolean;
  gegner: string;
  ort: string | null;
  status: string;
  teamName: string;
};

function zuEvent(s: SpielRow): KalenderEvent {
  const ha = s.heim ? "Heim" : "Auswärts";
  return {
    uid: `${s.id}@aufstellungs-assistent`,
    datum: s.datum,
    uhrzeit: s.uhrzeit,
    titel: `TT ${s.teamName}: ${s.gegner} (${ha})`,
    ort: s.ort,
    beschreibung: `Spieltag ${s.spieltag_nr} · ${ha} gegen ${s.gegner}`,
  };
}

// Alle Spieltage EINER Mannschaft (laufende Halbserie).
export async function ladeTeamKalender(
  supabase: SupabaseClient,
  teamId: string
): Promise<{ name: string; events: KalenderEvent[] } | null> {
  const hs = await aktiveHalbserie(supabase);
  if (!hs) return null;

  const { data: team } = await supabase
    .from("mannschaften")
    .select("name")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return null;
  const teamName = (team as any).name as string;

  const { data: spiele } = await supabase
    .from("spiele")
    .select("id, spieltag_nr, datum, uhrzeit, heim, gegner, ort, status")
    .eq("mannschaft_id", teamId)
    .eq("halbserie_id", hs)
    .neq("status", "abgesetzt")
    .order("datum", { ascending: true });

  const events = (spiele ?? []).map((s: any) =>
    zuEvent({ ...s, teamName })
  );
  return { name: `TT ${teamName}`, events };
}

// Persönlicher Kalender: alle Spiele der Stamm-Mannschaft PLUS jedes Spiel, dem
// der Spieler zugesagt hat oder für das er als Ersatz eingeplant ist (auch
// anderer Mannschaften) — deckt sich mit der Liste unter „Meine Spieltage".
export async function ladeSpielerKalender(
  supabase: SupabaseClient,
  spielerId: string
): Promise<{ name: string; events: KalenderEvent[] } | null> {
  const hs = await aktiveHalbserie(supabase);
  if (!hs) return null;

  const spielIds = new Set<string>();

  // 1) Stamm-Mannschaft
  const stammTeam = await ladeStammTeamId(supabase, hs, spielerId);
  if (stammTeam) {
    const { data: eigene } = await supabase
      .from("spiele")
      .select("id")
      .eq("mannschaft_id", stammTeam)
      .eq("halbserie_id", hs)
      .neq("status", "abgesetzt");
    for (const s of eigene ?? []) spielIds.add((s as any).id);
  }

  // 2) Ersatzeinsätze dieses Spielers (evtl. andere Mannschaften)
  const { data: eins } = await supabase
    .from("einsaetze")
    .select("spiel_id")
    .eq("halbserie_id", hs)
    .eq("spieler_id", spielerId);
  for (const e of eins ?? [])
    if ((e as any).spiel_id) spielIds.add((e as any).spiel_id);

  // 3) Zusagen (auch Aushilfen in anderen Mannschaften, die noch nicht fest
  //    eingeplant sind) — auf die laufende Halbserie beschränkt.
  const { data: zus } = await supabase
    .from("verfuegbarkeiten")
    .select("spiel_id, spiele:spiel_id(halbserie_id)")
    .eq("spieler_id", spielerId)
    .eq("status", "zugesagt");
  for (const v of (zus ?? []) as any[])
    if (v.spiel_id && v.spiele?.halbserie_id === hs) spielIds.add(v.spiel_id);

  // 4) Eigene Absagen wieder herausnehmen — Spiele, für die der Spieler
  //    abgesagt hat (oder anderweitig verplant ist), gehören nicht in seinen
  //    Kalender, auch wenn es Spiele seiner Stamm-Mannschaft sind.
  const { data: abg } = await supabase
    .from("verfuegbarkeiten")
    .select("spiel_id, spiele:spiel_id(halbserie_id)")
    .eq("spieler_id", spielerId)
    .in("status", ["abgesagt", "extern_verplant"]);
  for (const v of (abg ?? []) as any[])
    if (v.spiel_id && v.spiele?.halbserie_id === hs) spielIds.delete(v.spiel_id);

  if (spielIds.size === 0) return { name: "TT: Meine Spiele", events: [] };

  const { data: spiele } = await supabase
    .from("spiele")
    .select(
      "id, spieltag_nr, datum, uhrzeit, heim, gegner, ort, status, mannschaften:mannschaft_id(name)"
    )
    .in("id", Array.from(spielIds))
    .neq("status", "abgesetzt")
    .order("datum", { ascending: true });

  const events = (spiele ?? []).map((s: any) =>
    zuEvent({ ...s, teamName: s.mannschaften?.name ?? "Mannschaft" })
  );
  return { name: "TT: Meine Spiele", events };
}
