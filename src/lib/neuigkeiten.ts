// =============================================================================
// Neuigkeiten / Changelog — rollengefiltert.
//
// Pflege: Bei jeder nennenswerten Änderung oben einen Eintrag ergänzen und die
// passenden Rollen setzen. Rolle spieler sieht jeder (jeder ist mindestens
// Spieler), mf/admin nur, wer die Rolle wirklich hat. Datum als YYYY-MM-DD.
// Reihenfolge egal — es wird nach Datum absteigend sortiert.
//
// Hinweis: In den Texten bewusst KEINE geraden Anführungszeichen verwenden
// (die beenden den String); Feature-Namen ohne Anführungszeichen schreiben.
// =============================================================================

export type Rolle = "spieler" | "mf" | "admin";

export type Neuigkeit = {
  id: string; // stabil, eindeutig
  datum: string; // "YYYY-MM-DD"
  titel: string;
  text: string;
  rollen: Rolle[]; // für wen relevant
};

export const NEUIGKEITEN: Neuigkeit[] = [
  {
    id: "2026-09-kalender-export",
    datum: "2026-09-05",
    titel: "Spieltage in deinen Kalender",
    text: "Du kannst deine Spiele jetzt als Kalenderdatei (.ics) laden — persönlich unter Spieltagsplanung über Meine Spiele als Kalender, oder je Mannschaft über den Kalender-Button in der Übersicht. Import in Google, Apple oder Outlook inklusive Uhrzeit und Halle.",
    rollen: ["spieler", "mf", "admin"],
  },
  {
    id: "2026-09-alle-spieltage",
    datum: "2026-09-05",
    titel: "Neue Übersicht: Alle Spieltage",
    text: "Oben in der Navigation findest du Alle Spieltage: alle Mannschaften kompakt nach Kalenderwoche sortiert — praktisch für den schnellen Gesamtüberblick.",
    rollen: ["spieler", "mf", "admin"],
  },
  {
    id: "2026-09-verlegt-marker",
    datum: "2026-09-05",
    titel: "Verlegte Spiele sind gekennzeichnet",
    text: "In der Übersicht trägt ein verschobener Spieltag jetzt ein kleines Verlegt-Zeichen (mit ursprünglichem Datum im Tooltip). So behältst du über die Saison den Überblick, welche Termine gewandert sind.",
    rollen: ["spieler", "mf", "admin"],
  },
  {
    id: "2026-09-verlegung-in-klaerung",
    datum: "2026-09-05",
    titel: "Spieltag als in Klärung markieren",
    text: "Solange über eine Verlegung noch verhandelt wird, kannst du den Spieltag im Detail unter Spiel bearbeiten als in Klärung markieren. Der Termin bleibt bestehen und wird normal abgefragt; bereits zugesagte Spieler bekommen eine kurze Vorwarnung. Beim tatsächlichen Verlegen verschwindet der Marker von selbst.",
    rollen: ["mf", "admin"],
  },
  {
    id: "2026-09-abwesend-ersatz",
    datum: "2026-09-05",
    titel: "Abwesende Ersatzkandidaten sind sichtbar",
    text: "Ein Kandidat, der im Urlaub ist, verschwindet nicht mehr aus den Ersatzvorschlägen, sondern wird als Abwesend (bis TT.MM.) angezeigt und gesperrt — auch bei Spielern aus anderen Mannschaften. So weißt du sofort, warum jemand ausfällt.",
    rollen: ["mf", "admin"],
  },
  {
    id: "2026-09-login-fix",
    datum: "2026-09-05",
    titel: "Anmelde-Problem behoben",
    text: "Wenn dein Konto nach einer E-Mail-Korrektur nicht mit deinem Spielerprofil verbunden war, wird das beim nächsten Login jetzt automatisch nachgeholt. Falls du früher den Hinweis kein Spielerprofil verknüpft gesehen hast: einfach neu anmelden.",
    rollen: ["spieler", "mf", "admin"],
  },
];

function rollenSchnitt(a: Rolle[], b: Rolle[]): boolean {
  return a.some((r) => b.includes(r));
}

// Alle Neuigkeiten, die für die gegebenen Rollen relevant sind (neueste zuerst).
export function fuerRollen(rollen: Rolle[]): Neuigkeit[] {
  return NEUIGKEITEN.filter((n) => rollenSchnitt(n.rollen, rollen)).sort((a, b) =>
    b.datum.localeCompare(a.datum)
  );
}

// Davon die ungelesenen (Datum neuer als der Merker; ohne Merker = alle).
export function ungelesene(
  rollen: Rolle[],
  gesehenAm: string | null
): Neuigkeit[] {
  const rel = fuerRollen(rollen);
  if (!gesehenAm) return rel;
  const grenze = gesehenAm.slice(0, 10); // Datumsteil des Zeitstempels
  return rel.filter((n) => n.datum > grenze);
}

// Rollenmenge eines Nutzers: jeder ist Spieler, MF/Admin je nach echter Rolle.
export function rollenVon(opts: {
  realIsMf?: boolean;
  realIsAdmin?: boolean;
}): Rolle[] {
  const r: Rolle[] = ["spieler"];
  if (opts.realIsMf) r.push("mf");
  if (opts.realIsAdmin) r.push("admin");
  return r;
}
