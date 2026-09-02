// =============================================================================
// iCalendar-Erzeugung (.ics) — reine, testbare Funktionen ohne DB-Zugriff.
//
// Erzeugt einen Kalender mit einem VEVENT je Spieltag. Spiele mit Uhrzeit
// werden als Termin mit Zeit (Standarddauer 2,5 h, Zeitzone Europe/Berlin)
// ausgegeben, Spiele ohne Uhrzeit als Ganztagestermin. Damit lässt sich die
// Datei in jeden gängigen Kalender importieren.
// =============================================================================

export type KalenderEvent = {
  uid: string; // stabile, eindeutige Kennung (z. B. Spiel-ID)
  datum: string; // "YYYY-MM-DD"
  uhrzeit: string | null; // "HH:MM" oder "HH:MM:SS", null = ganztägig
  titel: string;
  ort?: string | null;
  beschreibung?: string | null;
  dauerMin?: number; // Minuten, Standard 150
};

// Sonderzeichen gemäß RFC 5545 maskieren
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Lange Zeilen auf 75 Oktette falten (Fortsetzung mit führendem Leerzeichen).
function fold(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    // 74, damit mit dem eingefügten Leerzeichen 75 nicht überschritten wird
    if (bytes + b > 74) {
      out.push(cur);
      cur = " " + ch;
      bytes = 1 + b;
    } else {
      cur += ch;
      bytes += b;
    }
  }
  if (cur) out.push(cur);
  return out.join("\r\n");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// "YYYY-MM-DD" -> "YYYYMMDD"
function datumKompakt(iso: string): string {
  return iso.replace(/-/g, "");
}

// Lokale Zeit als "YYYYMMDDTHHMMSS" (ohne Z; TZID trägt die Zone)
function lokalStempel(iso: string, uhrzeit: string): string {
  const [h, m] = uhrzeit.split(":");
  return `${datumKompakt(iso)}T${pad(Number(h))}${pad(Number(m ?? 0))}00`;
}

// Datum + Minuten -> lokaler Endzeit-Stempel (rechnet über Date, ohne Zone)
function endStempel(iso: string, uhrzeit: string, dauerMin: number): string {
  const [h, m] = uhrzeit.split(":").map((x) => Number(x));
  const d = new Date(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
    h,
    m ?? 0
  );
  d.setMinutes(d.getMinutes() + dauerMin);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(
    d.getHours()
  )}${pad(d.getMinutes())}00`;
}

// Nächster Tag als "YYYYMMDD" (für DTEND bei Ganztagesterminen)
function naechsterTag(iso: string): string {
  const d = new Date(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10))
  );
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function nowStempelUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(
    d.getUTCDate()
  )}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// Vollständige Europe/Berlin-Zeitzonendefinition (CET/CEST) — damit Uhrzeiten
// in jedem Kalender korrekt und sommerzeitsicher landen.
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Berlin",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function baueICS(events: KalenderEvent[], kalenderName: string): string {
  const stamp = nowStempelUtc();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aufstellungs-Assistent//Spielplan//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(kalenderName)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    ...VTIMEZONE,
  ];

  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (e.uhrzeit) {
      const dauer = e.dauerMin && e.dauerMin > 0 ? e.dauerMin : 150;
      lines.push(`DTSTART;TZID=Europe/Berlin:${lokalStempel(e.datum, e.uhrzeit)}`);
      lines.push(
        `DTEND;TZID=Europe/Berlin:${endStempel(e.datum, e.uhrzeit, dauer)}`
      );
    } else {
      lines.push(`DTSTART;VALUE=DATE:${datumKompakt(e.datum)}`);
      lines.push(`DTEND;VALUE=DATE:${naechsterTag(e.datum)}`);
    }
    lines.push(`SUMMARY:${esc(e.titel)}`);
    if (e.ort) lines.push(`LOCATION:${esc(e.ort)}`);
    if (e.beschreibung) lines.push(`DESCRIPTION:${esc(e.beschreibung)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
