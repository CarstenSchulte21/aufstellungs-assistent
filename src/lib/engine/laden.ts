import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ermittleKandidaten,
  type EngineSpieler,
  type EngineConfig,
  type Kandidat,
} from "./kandidaten";

// Sammelt alle nötigen Daten aus der DB und ruft die reine Engine auf.
export async function ladeKandidaten(
  supabase: SupabaseClient,
  spielId: string
): Promise<{ kandidaten: Kandidat[]; teamNummer: number } | null> {
  const { data: spiel } = await supabase
    .from("spiele")
    .select(
      "id, datum, heim, halbserie_id, mannschaft_id, mannschaften:mannschaft_id(nummer)"
    )
    .eq("id", spielId)
    .maybeSingle();
  if (!spiel) return null;

  const hs = (spiel as any).halbserie_id;
  const datum = (spiel as any).datum;
  const teamNummer = (spiel as any).mannschaften?.nummer ?? 0;

  // Meldung + Spielerstammdaten
  const { data: meld } = await supabase
    .from("meldungen")
    .select(
      "spieler_id, mannschaft_id, position, sperrvermerk, res, mannschaften:mannschaft_id(nummer), spieler:spieler_id(name, qttr, praeferenzen)"
    )
    .eq("halbserie_id", hs);

  // Kader-Status
  const { data: kader } = await supabase
    .from("kader_status")
    .select("spieler_id, status")
    .eq("halbserie_id", hs);
  const statusVon = new Map<string, string>(
    (kader ?? []).map((k: any) => [k.spieler_id, k.status])
  );

  // Spiele am selben Tag (alle Mannschaften)
  const { data: spieleAmTag } = await supabase
    .from("spiele")
    .select("id, mannschaft_id")
    .eq("halbserie_id", hs)
    .eq("datum", datum);
  const spielIdsAmTag = (spieleAmTag ?? []).map((s: any) => s.id);
  const mannschaftIdsAmTag = Array.from(
    new Set((spieleAmTag ?? []).map((s: any) => s.mannschaft_id))
  );
  // Team-Nummern mit Spiel am selben Tag (für weiche Warnung)
  const nummerVon = new Map<string, number>();
  for (const m of meld ?? [])
    nummerVon.set((m as any).mannschaft_id, (m as any).mannschaften?.nummer ?? 0);
  const spieltAmTagNummern = mannschaftIdsAmTag
    .map((id: any) => nummerVon.get(id) ?? 0)
    .filter((n) => n > 0);

  // Wer hat an diesem Tag schon irgendwo ZUGESAGT -> gesperrt (nicht anfragbar)
  let zugesagtAmTag: string[] = [];
  if (spielIdsAmTag.length > 0) {
    const { data: zus } = await supabase
      .from("verfuegbarkeiten")
      .select("spieler_id")
      .in("spiel_id", spielIdsAmTag)
      .eq("status", "zugesagt");
    zugesagtAmTag = (zus ?? []).map((v: any) => v.spieler_id);
  }

  // Offene Ersatzanfragen am selben Tag -> Lock
  const { data: locks } = await supabase
    .from("ersatzanfragen")
    .select("spieler_id, status")
    .eq("spiel_datum", datum)
    .in("status", ["freigegeben", "gesendet"]);
  const lockAktiv = (locks ?? []).map((l: any) => l.spieler_id);

  // Abwesenheiten, die diesen Tag abdecken -> nicht verfügbar
  const { data: abw } = await supabase
    .from("abwesenheiten")
    .select("spieler_id")
    .lte("von", datum)
    .gte("bis", datum);
  const nichtVerfuegbar = (abw ?? []).map((a: any) => a.spieler_id);

  // Ersatzeinsätze diese Halbserie (nur Zähler/Info)
  const { data: eins } = await supabase
    .from("einsaetze")
    .select("spieler_id")
    .eq("halbserie_id", hs)
    .eq("ersatz", true);
  const einsaetze: Record<string, number> = {};
  for (const e of eins ?? [])
    einsaetze[(e as any).spieler_id] = (einsaetze[(e as any).spieler_id] ?? 0) + 1;

  // Regelkonfiguration der Lücken-Mannschaft
  const { data: cfg } = await supabase
    .from("regel_config")
    .select("config")
    .eq("mannschaft_id", (spiel as any).mannschaft_id)
    .eq("halbserie_id", hs)
    .maybeSingle();
  const config: EngineConfig = (cfg?.config as EngineConfig) ?? {};

  const kandidaten: EngineSpieler[] = (meld ?? []).map((m: any) => ({
    id: m.spieler_id,
    name: m.spieler?.name ?? "—",
    teamNummer: m.mannschaften?.nummer ?? 99,
    position: m.position,
    qttr: m.spieler?.qttr ?? 0,
    sperrvermerk: m.sperrvermerk,
    res: m.res,
    kaderStatus: (statusVon.get(m.spieler_id) ?? "aktiv") as any,
    praeferenzen: m.spieler?.praeferenzen ?? {},
  }));

  const result = ermittleKandidaten({
    luecke: { teamNummer, datum, heim: (spiel as any).heim },
    kandidaten,
    zugesagtAmTag,
    spieltAmTagNummern,
    lockAktiv,
    nichtVerfuegbar,
    einsaetze,
    config,
  });

  return { kandidaten: result, teamNummer };
}
