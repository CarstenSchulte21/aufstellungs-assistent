import { createHmac, timingSafeEqual } from "crypto";

// Signierte Ein-Klick-Antwortlinks für E-Mails. Der Token enthält Spieler,
// Spiel und Antwort und ist mit einem Server-Geheimnis signiert — er lässt
// sich also nicht raten oder auf andere Spieler ummünzen. Kein DB-Eintrag
// nötig (zustandslos).
//
// Umgebungsvariable: ANTWORT_SECRET (langer Zufallswert, nur auf dem Server)

export type Antwort = "zugesagt" | "abgesagt" | "unsicher";

function geheimnis(): string {
  return process.env.ANTWORT_SECRET || "";
}

function signiere(daten: string): string {
  return createHmac("sha256", geheimnis()).update(daten).digest("base64url");
}

export function baueAntwortToken(
  spielerId: string,
  spielId: string,
  antwort: Antwort
): string {
  const daten = `${spielerId}|${spielId}|${antwort}`;
  const nutzlast = Buffer.from(daten, "utf8").toString("base64url");
  return `${nutzlast}.${signiere(daten)}`;
}

export function pruefeAntwortToken(
  token: string
): { spielerId: string; spielId: string; antwort: Antwort } | null {
  if (!geheimnis() || !token || !token.includes(".")) return null;
  const [nutzlast, sig] = token.split(".");
  let daten = "";
  try {
    daten = Buffer.from(nutzlast, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const erwartet = signiere(daten);
  const a = Buffer.from(sig ?? "", "utf8");
  const b = Buffer.from(erwartet, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [spielerId, spielId, antwort] = daten.split("|");
  if (!spielerId || !spielId) return null;
  if (!["zugesagt", "abgesagt", "unsicher"].includes(antwort ?? "")) return null;
  return { spielerId, spielId, antwort: antwort as Antwort };
}
