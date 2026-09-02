// =============================================================================
// Regel-Engine · Ersatz-Kandidatenermittlung (WTTV)
//
// Reine, deterministische Funktionen — KEINE LLM-Aufrufe, keine DB-Zugriffe.
// Das LLM interpretiert keine WTTV-Regeln (CLAUDE.md-Prinzip 2).
//
// Verifizierte WTTV-Regeln (Stand 2020, Reform 2017; Festspielen abgeschafft):
//   Harte Filter für eine Lücke in Mannschaft K am Tag D:
//     - nur von unten nach oben (Kandidat in tieferer Mannschaft, Nummer > K)
//     - namentlich gemeldet, KEIN Sperrvermerk
//     - nicht am selben Tag anderweitig verplant / kein aktiver Lock
//     - verfügbar (Kader aktiv, nicht abwesend/abgesagt)
//     - nicht als Tabu-Spieler konfiguriert
//   Weiche Annotationen (kein Ausschluss): RES, Präferenzen, Einsatzzähler.
//   Ersatzeinsätze sind zahlenmäßig NICHT begrenzt (kein Festspielen).
// =============================================================================

export type Praeferenzen = {
  nur_heimspiele?: boolean;
  keine_doppeleinsaetze?: boolean;
  hilft_aus_bis_mannschaft?: number;
  gesperrte_wochentage?: string[]; // "Mo","Di",...,"So"
};

export type EngineSpieler = {
  id: string;
  name: string;
  teamNummer: number; // gemeldete Mannschaft
  position: number;
  qttr: number;
  sperrvermerk: boolean;
  res: boolean;
  kaderStatus: "aktiv" | "pausiert" | "inaktiv";
  praeferenzen?: Praeferenzen;
};

export type EngineConfig = {
  kaskade?: number[]; // explizite Reihenfolge der Mannschaftsnummern
  kaskade_sortierung?: "position" | "qttr";
  tabu_spieler?: string[];
  max_ersatzeinsaetze_pro_spieler?: number; // optionale weiche Vereinsgrenze
};

export type EngineKontext = {
  luecke: { teamNummer: number; datum: string; heim: boolean };
  kandidaten: EngineSpieler[];
  zugesagtAmTag?: string[]; // hat am selben Tag schon irgendwo zugesagt -> gesperrt
  spieltAmTagNummern?: number[]; // Mannschaftsnummern mit Spiel am selben Tag (weiche Warnung)
  lockAktiv?: string[]; // offene Ersatzanfrage am selben Tag (andere Mannschaft)
  nichtVerfuegbar?: string[]; // hart ausgeschlossen (z. B. Absage für dieses Spiel)
  abwesend?: Record<string, string>; // im Urlaub o. Ä.: id -> bis-Datum (ISO), sichtbar aber gesperrt
  einsaetze?: Record<string, number>; // Ersatzeinsätze diese Halbserie
  config?: EngineConfig;
};

export type Kandidat = {
  id: string;
  name: string;
  teamNummer: number;
  position: number;
  qttr: number;
  einsaetze: number;
  warnungen: string[];
  locked: boolean; // offener Lock -> nur informativ, nicht freigebbar
  favorit?: boolean; // im Kader dieser Mannschaft als Favorit hinterlegt
  abwesend?: boolean; // im Urlaub o. Ä. -> sichtbar, aber nicht anfragbar
};

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export function wochentag(iso: string): string {
  return WOCHENTAGE[new Date(iso + "T00:00:00").getDay()];
}

// Kurzformat TT.MM. für Abwesenheits-Hinweise
function tagMonat(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}.`;
}

/**
 * Ermittelt die zulässigen Ersatzkandidaten für eine Lücke, sortiert nach
 * Kaskade und Konfiguration, mit weichen Warnungen und Lock-Kennzeichnung.
 */
export function ermittleKandidaten(ctx: EngineKontext): Kandidat[] {
  const zugesagt = new Set(ctx.zugesagtAmTag ?? []);
  const spieltNummern = new Set(ctx.spieltAmTagNummern ?? []);
  const lock = new Set(ctx.lockAktiv ?? []);
  const nv = new Set(ctx.nichtVerfuegbar ?? []);
  const abwesend = ctx.abwesend ?? {};
  const tabu = new Set(ctx.config?.tabu_spieler ?? []);
  const einsaetze = ctx.einsaetze ?? {};
  const max = ctx.config?.max_ersatzeinsaetze_pro_spieler;
  const wd = wochentag(ctx.luecke.datum);

  const gefiltert = ctx.kandidaten.filter(
    (s) =>
      s.teamNummer > ctx.luecke.teamNummer && // nur von unten nach oben
      !s.sperrvermerk &&
      s.kaderStatus === "aktiv" &&
      !nv.has(s.id) &&
      !tabu.has(s.id)
  );

  const kandidaten: Kandidat[] = gefiltert.map((s) => {
    const warnungen: string[] = [];
    const p = s.praeferenzen ?? {};
    // Abwesend (Urlaub o. Ä.): sichtbar, damit auch ein fremder MF weiß, warum
    // dieser Kandidat ausfällt — aber gesperrt (nicht anfragbar).
    const istAbwesend = s.id in abwesend;
    if (istAbwesend) {
      const bis = tagMonat(abwesend[s.id] ?? "");
      warnungen.push(bis ? `Abwesend (bis ${bis})` : "Abwesend");
    }
    // Tages-Konflikt: schon zugesagt -> gesperrt; eigene Mannschaft spielt,
    // aber noch keine Zusage -> nur Hinweis (anfragbar).
    if (zugesagt.has(s.id))
      warnungen.push("Hat für diesen Tag bereits zugesagt");
    else if (spieltNummern.has(s.teamNummer))
      warnungen.push("Eigene Mannschaft spielt am selben Tag (noch offen)");
    if (s.res) warnungen.push("Reservespieler (RES)");
    if (p.nur_heimspiele && !ctx.luecke.heim)
      warnungen.push("Präferenz: nur Heimspiele");
    if (p.keine_doppeleinsaetze)
      warnungen.push("Präferenz: keine Doppeleinsätze");
    if (
      typeof p.hilft_aus_bis_mannschaft === "number" &&
      ctx.luecke.teamNummer < p.hilft_aus_bis_mannschaft
    )
      warnungen.push(
        `Präferenz: hilft normalerweise nur bis zur ${p.hilft_aus_bis_mannschaft}. Mannschaft`
      );
    if (p.gesperrte_wochentage?.includes(wd))
      warnungen.push(`Präferenz: spielt nicht am ${wd}`);

    const n = einsaetze[s.id] ?? 0;
    if (max && max > 0 && n >= max)
      warnungen.push(
        `Bereits ${n} ${n === 1 ? "Ersatzeinsatz" : "Ersatzeinsätze"}`
      );

    return {
      id: s.id,
      name: s.name,
      teamNummer: s.teamNummer,
      position: s.position,
      qttr: s.qttr,
      einsaetze: n,
      warnungen,
      locked: lock.has(s.id) || zugesagt.has(s.id) || istAbwesend,
      abwesend: istAbwesend,
    };
  });

  const kaskade = ctx.config?.kaskade;
  const sortierung = ctx.config?.kaskade_sortierung ?? "position";
  const rang = (nummer: number) => {
    if (kaskade && kaskade.length > 0) {
      const i = kaskade.indexOf(nummer);
      return i === -1 ? 1000 + nummer : i;
    }
    return nummer; // Standard: nächstniedrigere Mannschaft zuerst
  };

  kandidaten.sort(
    (a, b) =>
      rang(a.teamNummer) - rang(b.teamNummer) ||
      (sortierung === "qttr"
        ? b.qttr - a.qttr
        : a.position - b.position) ||
      a.name.localeCompare(b.name)
  );

  return kandidaten;
}
