import type { SupabaseClient } from "@supabase/supabase-js";

// Zentrale Helfer für den operativen Kader (kader_zuordnung).
// Stamm = automatisch gefragt, Favorit = Anzeige/gezielt. Die offizielle
// Meldung (meldungen) bleibt davon unberührt und ist Sache der Regel-Engine.

export type KaderRolle = "stamm" | "favorit";

// Stamm-Spieler-IDs einer Mannschaft (aktive Halbserie über halbserieId).
export async function ladeStammIds(
  client: SupabaseClient,
  halbserieId: string,
  mannschaftId: string
): Promise<string[]> {
  const { data } = await client
    .from("kader_zuordnung")
    .select("spieler_id")
    .eq("halbserie_id", halbserieId)
    .eq("mannschaft_id", mannschaftId)
    .eq("rolle", "stamm");
  return (data ?? []).map((z: any) => z.spieler_id);
}

// Stamm + Favoriten einer Mannschaft.
export async function ladeEffektiveKader(
  client: SupabaseClient,
  halbserieId: string,
  mannschaftId: string
): Promise<{ stamm: string[]; favorit: string[] }> {
  const { data } = await client
    .from("kader_zuordnung")
    .select("spieler_id, rolle")
    .eq("halbserie_id", halbserieId)
    .eq("mannschaft_id", mannschaftId);
  const stamm: string[] = [];
  const favorit: string[] = [];
  for (const z of data ?? []) {
    if ((z as any).rolle === "stamm") stamm.push((z as any).spieler_id);
    else favorit.push((z as any).spieler_id);
  }
  return { stamm, favorit };
}

// Alle effektiven Kader-Mitglieder (stamm ODER favorit) einer Mannschaft.
export async function ladeEffektiveKaderIds(
  client: SupabaseClient,
  halbserieId: string,
  mannschaftId: string
): Promise<string[]> {
  const { stamm, favorit } = await ladeEffektiveKader(
    client,
    halbserieId,
    mannschaftId
  );
  return [...stamm, ...favorit];
}

// Die Stamm-Mannschaft eines Spielers (oder null). Genau eine je Halbserie.
export async function ladeStammTeamId(
  client: SupabaseClient,
  halbserieId: string,
  spielerId: string
): Promise<string | null> {
  const { data } = await client
    .from("kader_zuordnung")
    .select("mannschaft_id")
    .eq("halbserie_id", halbserieId)
    .eq("spieler_id", spielerId)
    .eq("rolle", "stamm")
    .maybeSingle();
  return (data as any)?.mannschaft_id ?? null;
}
