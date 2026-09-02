import { describe, it, expect } from "vitest";
import { baueICS, type KalenderEvent } from "./ical";

const timed: KalenderEvent = {
  uid: "abc@test",
  datum: "2026-09-19",
  uhrzeit: "18:30",
  titel: "TT 1. Mannschaft: TTG Langenich II (Auswärts)",
  ort: "Sporthalle, Musterstr. 1",
  beschreibung: "Spieltag 3",
};

const ganztag: KalenderEvent = {
  uid: "def@test",
  datum: "2026-10-03",
  uhrzeit: null,
  titel: "TT 2. Mannschaft: SV Test (Heim)",
};

describe("baueICS", () => {
  it("erzeugt ein gültiges VCALENDAR-Grundgerüst mit Zeitzone", () => {
    const ics = baueICS([timed], "TT 1. Mannschaft");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("TZID:Europe/Berlin");
    // CRLF-Zeilenenden gemäß RFC 5545
    expect(ics.includes("\r\n")).toBe(true);
  });

  it("gibt Spiele mit Uhrzeit als Termin mit Start/Ende in lokaler Zone aus", () => {
    const ics = baueICS([timed], "Kal");
    expect(ics).toContain("DTSTART;TZID=Europe/Berlin:20260919T183000");
    // Standarddauer 150 Min -> 21:00
    expect(ics).toContain("DTEND;TZID=Europe/Berlin:20260919T210000");
    expect(ics).toContain("LOCATION:Sporthalle\\, Musterstr. 1"); // Komma maskiert
  });

  it("gibt Spiele ohne Uhrzeit als Ganztagestermin aus", () => {
    const ics = baueICS([ganztag], "Kal");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261003");
    expect(ics).toContain("DTEND;VALUE=DATE:20261004");
  });

  it("schreibt je Ereignis genau ein VEVENT", () => {
    const ics = baueICS([timed, ganztag], "Kal");
    const anzahl = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(anzahl).toBe(2);
  });
});
