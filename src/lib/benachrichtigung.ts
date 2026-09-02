import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sendeMail,
  mailLayout,
  mailAbsatz,
  mailButton,
  mailErstkontakt,
  appUrl,
  MAIL_GRUEN,
  MAIL_ROT,
  MAIL_GELB,
} from "@/lib/mail";
import { baueAntwortToken } from "@/lib/antwortToken";

// Zentrale Kanal-Logik: Welcher Weg erreicht diesen Spieler?
//
// Maßgeblich ist spieler.kanal (vom MF im Kader gesetzt). Damit niemand
// unerreichbar bleibt, gibt es einen pragmatischen Rückfall: Wer auf Telegram
// steht, aber nicht gekoppelt ist, bekommt die Nachricht per E-Mail — sofern
// eine Adresse hinterlegt ist.

export type Kontakt = {
  id: string;
  name: string;
  email: string | null;
  chatId: number | null;
  kanal: string | null;
  keineMails: boolean;
};

export type Weg = "telegram" | "email" | "keiner";

// Der Spieler kann sich selbst gegen E-Mails entscheiden (Präferenz
// "keine_emails", gesetzt unter Spieltagsplanung). Das sticht die Kanal-
// Einstellung des MF: dann bleibt nur Telegram — oder gar nichts.
export function keineMailsGewuenscht(p: unknown): boolean {
  return Boolean((p as any)?.keine_emails);
}

export function wegFuer(k: {
  email?: string | null;
  telegram_chat_id?: string | number | null;
  kanal?: string | null;
  keineMails?: boolean;
}): Weg {
  const hatTelegram = Boolean(k.telegram_chat_id);
  const hatMail = Boolean(k.email) && !k.keineMails;
  if (k.kanal === "email") return hatMail ? "email" : hatTelegram ? "telegram" : "keiner";
  if (hatTelegram) return "telegram";
  return hatMail ? "email" : "keiner";
}

// Bequemer Aufruf: Weg direkt aus einem geladenen Kontakt bestimmen.
export function wegFuerKontakt(k: Kontakt | null): Weg {
  if (!k) return "keiner";
  return wegFuer({
    email: k.email,
    telegram_chat_id: k.chatId,
    kanal: k.kanal,
    keineMails: k.keineMails,
  });
}

export async function ladeKontakt(
  admin: SupabaseClient,
  spielerId: string
): Promise<Kontakt | null> {
  const { data } = await admin
    .from("spieler")
    .select("id, name, email, kanal, telegram_chat_id, praeferenzen")
    .eq("id", spielerId)
    .maybeSingle();
  if (!data) return null;
  const d = data as any;
  return {
    id: d.id,
    name: d.name,
    email: d.email ?? null,
    chatId: d.telegram_chat_id ? Number(d.telegram_chat_id) : null,
    kanal: d.kanal ?? null,
    keineMails: keineMailsGewuenscht(d.praeferenzen),
  };
}

// Hat dieser Spieler schon einmal eine E-Mail von uns bekommen? Wenn nicht,
// wird der ersten Mail eine kurze Ankündigung vorangestellt.
export async function istErsteMail(
  admin: SupabaseClient,
  spielerId: string
): Promise<boolean> {
  const { data } = await admin
    .from("nachrichten")
    .select("id")
    .eq("spieler_id", spielerId)
    .eq("kanal", "email")
    .limit(1);
  return (data ?? []).length === 0;
}

function fmtDatum(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

export function spielBeschreibung(spiel: {
  datum: string;
  uhrzeit?: string | null;
  heim: boolean;
  gegner: string;
}): string {
  const zeit = spiel.uhrzeit ? ` · ${String(spiel.uhrzeit).slice(0, 5)} Uhr` : "";
  return `${fmtDatum(spiel.datum)}${zeit} · ${
    spiel.heim ? "Heim" : "Auswärts"
  } gegen ${spiel.gegner}`;
}

// ── Verfügbarkeits-Abfrage per E-Mail (mit Ein-Klick-Antwortlinks) ──────────
export async function sendeAbfrageMail(
  admin: SupabaseClient,
  kontakt: Kontakt,
  spiel: {
    id: string;
    spieltag_nr: number;
    datum: string;
    uhrzeit?: string | null;
    heim: boolean;
    gegner: string;
    teamName: string;
  }
): Promise<boolean> {
  if (!kontakt.email || kontakt.keineMails) return false;
  const basis = appUrl();
  const link = (a: "zugesagt" | "abgesagt" | "unsicher") =>
    `${basis}/antwort?t=${baueAntwortToken(kontakt.id, spiel.id, a)}`;

  const erste = await istErsteMail(admin, kontakt.id);
  const html = mailLayout(
    (erste ? mailErstkontakt() : "") +
      mailAbsatz(`<strong>Spieltag ${spiel.spieltag_nr}</strong> der ${spiel.teamName}`) +
      mailAbsatz(spielBeschreibung(spiel)) +
      mailAbsatz("<strong>Bist du dabei?</strong> Ein Klick genügt:") +
      mailButton(link("zugesagt"), "✅ Ich bin dabei", MAIL_GRUEN) +
      mailButton(link("abgesagt"), "❌ Ich kann nicht", MAIL_ROT) +
      mailButton(link("unsicher"), "🤔 Unsicher", MAIL_GELB) +
      mailAbsatz(
        `<span style="font-size:13px;color:#64748b">Du kannst deine Antwort jederzeit ändern.</span>`
      )
  );

  const ok = await sendeMail({
    an: kontakt.email,
    name: kontakt.name,
    betreff: `${spiel.teamName}: ${spielBeschreibung(spiel)} — bist du dabei?`,
    html,
  });

  if (ok) {
    const { data: alt } = await admin
      .from("verfuegbarkeiten")
      .select("status")
      .eq("spiel_id", spiel.id)
      .eq("spieler_id", kontakt.id)
      .maybeSingle();
    const beantwortet = ["zugesagt", "abgesagt", "unsicher"].includes(
      (alt as any)?.status ?? ""
    );
    if (!beantwortet) {
      await admin.from("verfuegbarkeiten").upsert(
        {
          spiel_id: spiel.id,
          spieler_id: kontakt.id,
          status: "angefragt",
          quelle: "system",
        },
        { onConflict: "spiel_id,spieler_id" }
      );
    }
    await admin.from("nachrichten").insert({
      spieler_id: kontakt.id,
      spiel_id: spiel.id,
      richtung: "ausgehend",
      kanal: "email",
      typ: "abfrage",
      inhalt: `Abfrage per E-Mail: ${spielBeschreibung(spiel)}`,
    });
  }
  return ok;
}

// ── Allgemeine Info-Mail (Änderungen, Einplanung, Ersatz-Info …) ────────────
export async function sendeInfoMail(
  admin: SupabaseClient,
  kontakt: Kontakt,
  betreff: string,
  absaetze: string[],
  spielId?: string | null,
  typ: string = "bestaetigung"
): Promise<boolean> {
  if (!kontakt.email || kontakt.keineMails) return false;
  const erste = await istErsteMail(admin, kontakt.id);
  const html = mailLayout(
    (erste ? mailErstkontakt() : "") + absaetze.map((a) => mailAbsatz(a)).join("")
  );
  const ok = await sendeMail({
    an: kontakt.email,
    name: kontakt.name,
    betreff,
    html,
  });
  if (ok) {
    await admin.from("nachrichten").insert({
      spieler_id: kontakt.id,
      ...(spielId ? { spiel_id: spielId } : {}),
      richtung: "ausgehend",
      kanal: "email",
      typ,
      inhalt: betreff,
    });
  }
  return ok;
}
