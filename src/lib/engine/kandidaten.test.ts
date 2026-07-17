import { describe, it, expect } from "vitest";
import {
  ermittleKandidaten,
  wochentag,
  type EngineSpieler,
  type EngineKontext,
} from "./kandidaten";

// Hilfsfunktion zum Bauen eines Spielers mit Defaults
function sp(o: Partial<EngineSpieler> & { id: string; teamNummer: number }): EngineSpieler {
  return {
    name: o.name ?? o.id,
    position: o.position ?? 1,
    qttr: o.qttr ?? 1000,
    sperrvermerk: o.sperrvermerk ?? false,
    res: o.res ?? false,
    kaderStatus: o.kaderStatus ?? "aktiv",
    praeferenzen: o.praeferenzen,
    ...o,
  };
}

// Lücke in der 1. Mannschaft, Heimspiel am Freitag 11.09.2026
function ctx(kandidaten: EngineSpieler[], extra: Partial<EngineKontext> = {}): EngineKontext {
  return {
    luecke: { teamNummer: 1, datum: "2026-09-11", heim: true },
    kandidaten,
    ...extra,
  };
}

describe("ermittleKandidaten – harte Filter", () => {
  it("schlägt nur Spieler aus tieferen Mannschaften vor (nur von unten nach oben)", () => {
    const r = ermittleKandidaten(
      ctx([
        sp({ id: "hoeher", teamNummer: 1 }), // gleiche Mannschaft -> raus
        sp({ id: "tiefer", teamNummer: 3 }), // tiefer -> Kandidat
      ])
    );
    expect(r.map((k) => k.id)).toEqual(["tiefer"]);
  });

  it("schließt Spieler mit Sperrvermerk aus", () => {
    const r = ermittleKandidaten(
      ctx([
        sp({ id: "gesperrt", teamNummer: 2, sperrvermerk: true }),
        sp({ id: "frei", teamNummer: 2 }),
      ])
    );
    expect(r.map((k) => k.id)).toEqual(["frei"]);
  });

  it("schließt nicht aktive (pausiert/inaktiv) und nicht verfügbare Spieler aus", () => {
    const r = ermittleKandidaten(
      ctx(
        [
          sp({ id: "pausiert", teamNummer: 2, kaderStatus: "pausiert" }),
          sp({ id: "inaktiv", teamNummer: 2, kaderStatus: "inaktiv" }),
          sp({ id: "abgesagt", teamNummer: 2 }),
          sp({ id: "ok", teamNummer: 2 }),
        ],
        { nichtVerfuegbar: ["abgesagt"] }
      )
    );
    expect(r.map((k) => k.id)).toEqual(["ok"]);
  });

  it("schließt Spieler aus, die am selben Tag schon verplant sind", () => {
    const r = ermittleKandidaten(
      ctx([sp({ id: "belegt", teamNummer: 2 }), sp({ id: "frei", teamNummer: 2 })], {
        belegtAmTag: ["belegt"],
      })
    );
    expect(r.map((k) => k.id)).toEqual(["frei"]);
  });

  it("schließt Tabu-Spieler aus", () => {
    const r = ermittleKandidaten(
      ctx([sp({ id: "tabu", teamNummer: 2 }), sp({ id: "frei", teamNummer: 2 })], {
        config: { tabu_spieler: ["tabu"] },
      })
    );
    expect(r.map((k) => k.id)).toEqual(["frei"]);
  });
});

describe("ermittleKandidaten – Lock", () => {
  it("zeigt gesperrte Spieler weiterhin an, aber als locked (nicht freigebbar)", () => {
    const r = ermittleKandidaten(
      ctx([sp({ id: "imLock", teamNummer: 2 })], { lockAktiv: ["imLock"] })
    );
    expect(r).toHaveLength(1);
    expect(r[0].locked).toBe(true);
  });
});

describe("ermittleKandidaten – Sortierung & Kaskade", () => {
  it("sortiert nächstniedrigere Mannschaft zuerst, dann nach Position", () => {
    const r = ermittleKandidaten(
      ctx([
        sp({ id: "m3p1", teamNummer: 3, position: 1 }),
        sp({ id: "m2p2", teamNummer: 2, position: 2 }),
        sp({ id: "m2p1", teamNummer: 2, position: 1 }),
      ])
    );
    expect(r.map((k) => k.id)).toEqual(["m2p1", "m2p2", "m3p1"]);
  });

  it("sortiert nach QTTR absteigend, wenn so konfiguriert", () => {
    const r = ermittleKandidaten(
      ctx(
        [
          sp({ id: "schwach", teamNummer: 2, position: 1, qttr: 1200 }),
          sp({ id: "stark", teamNummer: 2, position: 2, qttr: 1500 }),
        ],
        { config: { kaskade_sortierung: "qttr" } }
      )
    );
    expect(r.map((k) => k.id)).toEqual(["stark", "schwach"]);
  });

  it("berücksichtigt eine explizite Kaskaden-Reihenfolge", () => {
    const r = ermittleKandidaten(
      ctx(
        [
          sp({ id: "m2", teamNummer: 2 }),
          sp({ id: "m3", teamNummer: 3 }),
        ],
        { config: { kaskade: [3, 2] } } // 3. Mannschaft zuerst
      )
    );
    expect(r.map((k) => k.id)).toEqual(["m3", "m2"]);
  });
});

describe("ermittleKandidaten – weiche Annotationen", () => {
  it("annotiert RES, ohne auszuschließen", () => {
    const r = ermittleKandidaten(ctx([sp({ id: "res", teamNummer: 2, res: true })]));
    expect(r).toHaveLength(1);
    expect(r[0].warnungen).toContain("Reservespieler (RES)");
  });

  it("warnt bei 'nur Heimspiele' bei einem Auswärtsspiel", () => {
    const r = ermittleKandidaten(
      ctx([sp({ id: "heim", teamNummer: 2, praeferenzen: { nur_heimspiele: true } })], {
        luecke: { teamNummer: 1, datum: "2026-09-11", heim: false },
      })
    );
    expect(r[0].warnungen).toContain("Präferenz: nur Heimspiele");
  });

  it("warnt bei gesperrtem Wochentag (11.09.2026 ist ein Freitag)", () => {
    expect(wochentag("2026-09-11")).toBe("Fr");
    const r = ermittleKandidaten(
      ctx([
        sp({
          id: "keinFr",
          teamNummer: 2,
          praeferenzen: { gesperrte_wochentage: ["Fr"] },
        }),
      ])
    );
    expect(r[0].warnungen.some((w) => w.includes("Fr"))).toBe(true);
  });

  it("warnt, wenn die Lücke oberhalb der Aushilfsbereitschaft liegt", () => {
    const r = ermittleKandidaten(
      ctx([
        sp({
          id: "nurBis2",
          teamNummer: 3,
          praeferenzen: { hilft_aus_bis_mannschaft: 2 },
        }),
      ]) // Lücke in Mannschaft 1 < 2
    );
    expect(r[0].warnungen.some((w) => w.includes("hilft normalerweise"))).toBe(true);
  });

  it("warnt bei optionaler Vereinsgrenze für Ersatzeinsätze", () => {
    const r = ermittleKandidaten(
      ctx([sp({ id: "vielEinsatz", teamNummer: 2 })], {
        einsaetze: { vielEinsatz: 3 },
        config: { max_ersatzeinsaetze_pro_spieler: 2 },
      })
    );
    expect(r[0].warnungen.some((w) => w.includes("Ersatzeinsätze"))).toBe(true);
    expect(r[0].einsaetze).toBe(3);
  });

  it("ohne Vereinsgrenze gibt es KEINE Einsatz-Warnung (kein Festspielen im WTTV)", () => {
    const r = ermittleKandidaten(
      ctx([sp({ id: "vielEinsatz", teamNummer: 2 })], {
        einsaetze: { vielEinsatz: 9 },
      })
    );
    expect(r[0].warnungen.some((w) => w.includes("Ersatzeinsätze"))).toBe(false);
  });
});
