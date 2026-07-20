import type { SupabaseClient } from "@supabase/supabase-js";
import { heuteBerlin, plusTage } from "@/lib/cron";
import { ladeStammTeamId } from "@/lib/kader";

// Infos für den Spieler: Dinge, die er WISSEN sollte (im Gegensatz zu den
// Aufgaben, die er TUN muss). Bewusst zeitlich begrenzt, damit die Liste
// nicht zuwächst.

export type SpielerInfo = {
  typ:
    | "einsatz"
    | "eingeplant"
    | "aenderung"
    | "zurueckgezogen"
    | "abwesenheit"
    | "kopplung";
  titel: string;
  detail: string;
  datum?: string;
};

const TAGE_RUECKBLICK = 14; // wie lange Änderungen angezeigt werden

function fmtTag(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function zeit(u: string | null | undefined): string {
  return u ? ` · ${String(u).slice(0, 5)}` : "";
}

function gegnerText(s: any): string {
  return `${s.heim ? "Heim" : "Auswärts"} gegen ${s.gegner}`;
}

export async function loadSpielerInfos(
  supabase: SupabaseClient,
  spielerId: string
): Promise<SpielerInfo[]> {
  const heute = heuteBerlin();
  const grenze = plusTage(heute, -TAGE_RUECKBLICK);
  const infos: SpielerInfo[] = [];

  const { data: hs } = await supabase
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();
  const halbserieId = hs?.id ?? "";

  const spielFelder =
    "id, datum, uhrzeit, heim, gegner, ort, status, verlegt_von, zuletzt_geaendert_am, zuletzt_geaendert_art, mannschaft_id, mannschaften:mannschaft_id(name, nummer)";

  // Zusagen des Spielers (für nächsten Einsatz + betroffene Spiele)
  const { data: zusagen } = await supabase
    .from("verfuegbarkeiten")
    .select("spiel_id, status")
    .eq("spieler_id", spielerId);
  const zugesagtIds = (zusagen ?? [])
    .filter((v: any) => v.status === "zugesagt")
    .map((v: any) => v.spiel_id);
  const beteiligtIds = (zusagen ?? []).map((v: any) => v.spiel_id);

  // 1) Nächster Einsatz
  if (zugesagtIds.length > 0) {
    const { data: naechste } = await supabase
      .from("spiele")
      .select(spielFelder)
      .in("id", zugesagtIds)
      .neq("status", "abgesetzt")
      .gte("datum", heute)
      .order("datum")
      .limit(1);
    const s = (naechste ?? [])[0] as any;
    if (s) {
      infos.push({
        typ: "einsatz",
        titel: `Dein nächster Einsatz: ${fmtTag(s.datum)}${zeit(s.uhrzeit)}`,
        detail: `${s.mannschaften?.name ?? ""} · ${gegnerText(s)}${
          s.ort ? ` · ${s.ort}` : ""
        }`,
        datum: s.datum,
      });
    }
  }

  // 2) Fest eingeplant / zurückgezogen (Ersatzanfragen)
  const { data: anfragen } = await supabase
    .from("ersatzanfragen")
    .select(
      "id, status, beantwortet_am, spiel_datum, spiele:spiel_id(datum, uhrzeit, heim, gegner, mannschaften:mannschaft_id(name, nummer))"
    )
    .eq("spieler_id", spielerId)
    .in("status", ["eingeplant", "zurueckgezogen"]);
  for (const a of (anfragen ?? []) as any[]) {
    const s = a.spiele;
    const datum = s?.datum ?? a.spiel_datum;
    if (!datum || datum < heute) continue;
    if (a.status === "eingeplant") {
      infos.push({
        typ: "eingeplant",
        titel: `Fest eingeplant: ${fmtTag(datum)}${zeit(s?.uhrzeit)}`,
        detail: `Aushilfe für die ${s?.mannschaften?.nummer ?? "?"}. Mannschaft · ${
          s ? gegnerText(s) : ""
        }`,
        datum,
      });
    } else if (a.beantwortet_am && a.beantwortet_am >= grenze) {
      infos.push({
        typ: "zurueckgezogen",
        titel: `Anfrage zurückgezogen: ${fmtTag(datum)}`,
        detail: `Die Aushilfe für die ${
          s?.mannschaften?.nummer ?? "?"
        }. Mannschaft hat sich erledigt.`,
        datum,
      });
    }
  }

  // 3) Spielplan-Änderungen (eigene Mannschaft + Spiele, an denen er beteiligt ist)
  const stammTeam = await ladeStammTeamId(supabase, halbserieId, spielerId);
  const { data: geaendert } = await supabase
    .from("spiele")
    .select(spielFelder)
    .eq("halbserie_id", halbserieId)
    .gte("datum", heute)
    .not("zuletzt_geaendert_am", "is", null)
    .gte("zuletzt_geaendert_am", grenze)
    .order("datum");
  for (const s of (geaendert ?? []) as any[]) {
    const betrifftMich =
      (stammTeam && s.mannschaft_id === stammTeam) ||
      beteiligtIds.includes(s.id);
    if (!betrifftMich) continue;
    const wann = `${fmtTag(s.datum)}${zeit(s.uhrzeit)}`;
    let titel = "";
    let detail = `${s.mannschaften?.name ?? ""} · ${gegnerText(s)}`;
    switch (s.zuletzt_geaendert_art) {
      case "verlegt":
        titel = `Spiel verlegt auf ${wann}`;
        if (s.verlegt_von) detail += ` · ursprünglich ${fmtTag(s.verlegt_von)}`;
        break;
      case "uhrzeit":
        titel = `Neue Uhrzeit: ${wann}`;
        break;
      case "heimrecht":
        titel = `Heimrecht geändert: ${wann}`;
        if (s.ort) detail += ` · ${s.ort}`;
        break;
      case "abgesetzt":
        titel = `Spiel fällt aus: ${wann}`;
        break;
      default:
        continue;
    }
    infos.push({ typ: "aenderung", titel, detail, datum: s.datum });
  }

  // 4) Eigener Status: laufende/kommende Abwesenheit
  const { data: abw } = await supabase
    .from("abwesenheiten")
    .select("von, bis, grund")
    .eq("spieler_id", spielerId)
    .gte("bis", heute)
    .order("von");
  for (const a of (abw ?? []) as any[]) {
    infos.push({
      typ: "abwesenheit",
      titel: `Abwesend ${fmtTag(a.von)} – ${fmtTag(a.bis)}`,
      detail: a.grund
        ? `${a.grund} · Spieltage in diesem Zeitraum werden automatisch abgesagt.`
        : "Spieltage in diesem Zeitraum werden automatisch abgesagt.",
      datum: a.von,
    });
  }

  // 5) Eigener Status: Telegram-Kopplung fehlt
  const { data: sp } = await supabase
    .from("spieler")
    .select("telegram_chat_id")
    .eq("id", spielerId)
    .maybeSingle();
  if (!(sp as any)?.telegram_chat_id) {
    infos.push({
      typ: "kopplung",
      titel: "Telegram ist noch nicht verbunden",
      detail:
        "Ohne Verbindung bekommst du keine Abfragen per Telegram. Dein Mannschaftsführer kann dir einen Verbindungs-Link schicken.",
    });
  }

  const rang: Record<SpielerInfo["typ"], number> = {
    einsatz: 0,
    eingeplant: 1,
    aenderung: 2,
    zurueckgezogen: 3,
    abwesenheit: 4,
    kopplung: 5,
  };
  infos.sort(
    (a, b) =>
      rang[a.typ] - rang[b.typ] || (a.datum ?? "").localeCompare(b.datum ?? "")
  );
  return infos;
}
