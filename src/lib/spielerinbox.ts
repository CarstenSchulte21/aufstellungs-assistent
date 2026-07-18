import type { SupabaseClient } from "@supabase/supabase-js";
import { heuteBerlin } from "@/lib/cron";

export type SpielerAufgabe = {
  typ: "verfuegbarkeit" | "unsicher" | "ersatz";
  titel: string;
  detail: string;
  datum: string;
  anker: string; // z. B. "#s-<spielId>" oder "#e-<ersatzId>"
};

// Statuswerte einer offenen (unbeantworteten) Verfügbarkeitsabfrage.
const OFFEN_STATUS = new Set(["angefragt", "erinnert", "keine_antwort"]);
// Ersatzanfragen, auf die der Spieler noch reagieren muss.
const ERSATZ_OFFEN = new Set(["gesendet", "freigegeben"]);

/**
 * Offene To-dos aus Spielersicht (für den angegebenen Spieler):
 *  - Verfügbarkeit noch nicht beantwortet
 *  - mit „Unsicher" beantwortet (sollte konkretisiert werden)
 *  - offene Ersatzanfrage an mich
 * Nur kommende Spieltage (Datum >= heute).
 */
export async function loadSpielerAufgaben(
  supabase: SupabaseClient,
  spielerId: string
): Promise<SpielerAufgabe[]> {
  const heute = heuteBerlin();
  const items: SpielerAufgabe[] = [];

  const { data: hs } = await supabase
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();
  const halbserieId = hs?.id ?? "";

  // Eigene Mannschaft in der aktiven Halbserie
  const { data: meld } = halbserieId
    ? await supabase
        .from("meldungen")
        .select("mannschaft_id")
        .eq("spieler_id", spielerId)
        .eq("halbserie_id", halbserieId)
        .maybeSingle()
    : { data: null as any };

  if (meld?.mannschaft_id) {
    const { data: spiele } = await supabase
      .from("spiele")
      .select("id, datum, heim, gegner")
      .eq("mannschaft_id", meld.mannschaft_id)
      .eq("halbserie_id", halbserieId)
      .gte("datum", heute)
      .order("datum");
    const spielIds = (spiele ?? []).map((s: any) => s.id);
    const { data: verf } = spielIds.length
      ? await supabase
          .from("v_verfuegbarkeiten")
          .select("spiel_id, status")
          .eq("spieler_id", spielerId)
          .in("spiel_id", spielIds)
      : { data: [] as any[] };
    const statusVon = new Map<string, string>(
      (verf ?? []).map((v: any) => [v.spiel_id as string, v.status as string])
    );

    for (const s of (spiele ?? []) as any[]) {
      const status = statusVon.get(s.id) ?? "nicht_angefragt";
      const gegner = `${s.heim ? "Heim" : "Auswärts"} gegen ${s.gegner}`;
      if (OFFEN_STATUS.has(status)) {
        items.push({
          typ: "verfuegbarkeit",
          titel: "Verfügbarkeit offen",
          detail: gegner,
          datum: s.datum,
          anker: `#s-${s.id}`,
        });
      } else if (status === "unsicher") {
        items.push({
          typ: "unsicher",
          titel: "Unsicher – bitte festlegen",
          detail: gegner,
          datum: s.datum,
          anker: `#s-${s.id}`,
        });
      }
    }
  }

  // Ersatzanfragen an mich, die noch eine Antwort brauchen
  const { data: ers } = await supabase
    .from("ersatzanfragen")
    .select(
      "id, status, spiel_datum, spiele:spiel_id(datum, heim, gegner, mannschaften:mannschaft_id(nummer))"
    )
    .eq("spieler_id", spielerId)
    .in("status", ["gesendet", "freigegeben"])
    .order("spiel_datum", { ascending: true });
  for (const a of (ers ?? []) as any[]) {
    const datum = a.spiele?.datum ?? a.spiel_datum;
    if (!datum || datum < heute || !ERSATZ_OFFEN.has(a.status)) continue;
    const nr = a.spiele?.mannschaften?.nummer ?? 0;
    items.push({
      typ: "ersatz",
      titel: "Ersatzanfrage offen",
      detail: `Aushilfe für die ${nr}. Mannschaft · ${
        a.spiele?.heim ? "Heim" : "Auswärts"
      } gegen ${a.spiele?.gegner ?? ""}`,
      datum,
      anker: `#e-${a.id}`,
    });
  }

  items.sort((x, y) => (x.datum < y.datum ? -1 : x.datum > y.datum ? 1 : 0));
  return items;
}
