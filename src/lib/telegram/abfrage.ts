import { InlineKeyboard, type Bot } from "grammy";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ladeKontakt,
  wegFuer,
  wegFuerKontakt,
  keineMailsGewuenscht,
  sendeAbfrageMail,
} from "@/lib/benachrichtigung";

// Mögliche Antworten der Buttons -> Verfügbarkeits-Status
export const ANTWORT_STATUS: Record<string, string> = {
  ja: "zugesagt",
  nein: "abgesagt",
  unsicher: "unsicher",
};

export function statusLabel(status: string): string {
  switch (status) {
    case "zugesagt":
      return "Zugesagt ✅";
    case "abgesagt":
      return "Abgesagt ❌";
    case "unsicher":
      return "Unsicher 🤔";
    default:
      return status;
  }
}

// Inline-Tastatur für eine Spieltag-Abfrage. callback_data: v:<spielId>:<antwort>
export function abfrageKeyboard(spielId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Ja", `v:${spielId}:ja`)
    .text("❌ Nein", `v:${spielId}:nein`)
    .text("🤔 Unsicher", `v:${spielId}:unsicher`);
}

// Inline-Tastatur für eine Ersatzanfrage. callback_data: e:<anfrageId>:<antwort>
export function ersatzKeyboard(anfrageId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Ich helfe aus", `e:${anfrageId}:ja`)
    .text("❌ Diesmal nicht", `e:${anfrageId}:nein`);
}

export function ersatzText(spiel: {
  spieltag_nr: number;
  datum: string;
  uhrzeit?: string | null;
  heim: boolean;
  gegner: string;
  teamName: string;
}): string {
  const ha = spiel.heim ? "Heim" : "Auswärts";
  return (
    `🆘 *Ersatz gesucht* — die ${spiel.teamName} braucht dich!\n` +
    `Spieltag ${spiel.spieltag_nr}, ${fmtDatum(spiel.datum)}${zeitSuffix(spiel.uhrzeit)} · ${ha} gegen ${spiel.gegner}\n\n` +
    `Kannst du aushelfen?`
  );
}

function fmtDatum(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

function zeitSuffix(uhrzeit?: string | null): string {
  return uhrzeit ? ` · ${uhrzeit.slice(0, 5)} Uhr` : "";
}

export function abfrageText(spiel: {
  spieltag_nr: number;
  datum: string;
  uhrzeit?: string | null;
  heim: boolean;
  gegner: string;
  teamName: string;
}): string {
  const ha = spiel.heim ? "Heim" : "Auswärts";
  return (
    `🏓 *Spieltag ${spiel.spieltag_nr}* der ${spiel.teamName}\n` +
    `${fmtDatum(spiel.datum)}${zeitSuffix(spiel.uhrzeit)} · ${ha} gegen ${spiel.gegner}\n\n` +
    `Bist du dabei?`
  );
}

/**
 * Schreibt eine Verfügbarkeit (Upsert) und protokolliert den Diff im audit_log.
 * Läuft mit dem admin-Client (service_role).
 */
export async function upsertVerfuegbarkeit(
  admin: SupabaseClient,
  spielId: string,
  spielerId: string,
  status: string,
  quelle: string,
  kommentar: string | null = null
): Promise<void> {
  const { data: alt } = await admin
    .from("verfuegbarkeiten")
    .select("id, status")
    .eq("spiel_id", spielId)
    .eq("spieler_id", spielerId)
    .maybeSingle();

  await admin.from("verfuegbarkeiten").upsert(
    {
      spiel_id: spielId,
      spieler_id: spielerId,
      status,
      quelle,
      ...(kommentar !== null ? { kommentar } : {}),
    },
    { onConflict: "spiel_id,spieler_id" }
  );

  await admin.from("audit_log").insert({
    benutzer_id: null, // Bot/System
    aktion: "status_geaendert",
    entitaet: "verfuegbarkeiten",
    entitaet_id: null,
    details: {
      spiel_id: spielId,
      spieler_id: spielerId,
      alt: alt?.status ?? null,
      neu: status,
      quelle,
    },
  });
}

export type SpielInfo = {
  id: string;
  spieltag_nr: number;
  datum: string;
  uhrzeit: string | null;
  heim: boolean;
  gegner: string;
  mannschaft_id: string;
  halbserie_id: string;
  teamName: string;
};

export async function ladeSpiel(
  admin: SupabaseClient,
  spielId: string
): Promise<SpielInfo | null> {
  const { data } = await admin
    .from("spiele")
    .select(
      "id, spieltag_nr, datum, uhrzeit, heim, gegner, mannschaft_id, halbserie_id, mannschaften:mannschaft_id(name)"
    )
    .eq("id", spielId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    spieltag_nr: data.spieltag_nr,
    datum: data.datum,
    uhrzeit: (data as any).uhrzeit ?? null,
    heim: data.heim,
    gegner: data.gegner,
    mannschaft_id: data.mannschaft_id,
    halbserie_id: data.halbserie_id,
    teamName: (data as any).mannschaften?.name ?? "Mannschaft",
  };
}

// Bearbeitet die ursprüngliche Telegram-Ersatzanfrage, sodass sie den in der
// Webapp gesetzten Antwortstatus widerspiegelt (Nachricht + Buttons bleiben,
// aber die Antwortzeile wird ergänzt). Fehler werden geschluckt.
export async function aktualisiereErsatzNachricht(
  admin: SupabaseClient,
  bot: Bot,
  opts: {
    ersatzanfrageId: string;
    spielerId: string;
    spielId: string;
    antwort: "ja" | "nein";
  }
): Promise<void> {
  try {
    const { data: nachricht } = await admin
      .from("nachrichten")
      .select("telegram_message_id")
      .eq("ersatzanfrage_id", opts.ersatzanfrageId)
      .eq("richtung", "ausgehend")
      .not("telegram_message_id", "is", null)
      .limit(1)
      .maybeSingle();
    const messageId = (nachricht as any)?.telegram_message_id;
    if (!messageId) return;

    const { data: sp } = await admin
      .from("spieler")
      .select("telegram_chat_id")
      .eq("id", opts.spielerId)
      .maybeSingle();
    const chatId = (sp as any)?.telegram_chat_id;
    if (!chatId) return;

    const info = await ladeSpiel(admin, opts.spielId);
    const kopf = info ? ersatzText(info) : "Ersatzanfrage";
    const antwortZeile =
      opts.antwort === "ja"
        ? "➡️ *Deine Antwort (per Webapp): Ich helfe aus ✅*\n_Der Mannschaftsführer plant dich final ein. Doch anders? Einfach neu tippen._"
        : "➡️ *Deine Antwort (per Webapp): Diesmal nicht ❌*\n_Doch anders? Einfach neu tippen._";
    await bot.api.editMessageText(
      Number(chatId),
      Number(messageId),
      `${kopf}\n\n${antwortZeile}`,
      { parse_mode: "Markdown", reply_markup: ersatzKeyboard(opts.ersatzanfrageId) }
    );
  } catch {
    // Telegram-Aktualisierung ist optional — Fehler nicht weiterreichen.
  }
}

// Gekoppelte, aktive STAMM-Spieler einer Mannschaft (mit Telegram-Chat).
// Operative Ebene: gefragt wird der Stamm (kader_zuordnung), nicht die Meldung.
export async function gekoppelteSpieler(
  admin: SupabaseClient,
  spiel: SpielInfo
): Promise<{ spieler_id: string; chat_id: number }[]> {
  const { data: stamm } = await admin
    .from("kader_zuordnung")
    .select("spieler_id, spieler:spieler_id(telegram_chat_id)")
    .eq("mannschaft_id", spiel.mannschaft_id)
    .eq("halbserie_id", spiel.halbserie_id)
    .eq("rolle", "stamm");

  const { data: kader } = await admin
    .from("kader_status")
    .select("spieler_id, status")
    .eq("halbserie_id", spiel.halbserie_id);
  const aktiv = new Set(
    (kader ?? []).filter((k: any) => k.status === "aktiv").map((k: any) => k.spieler_id)
  );

  const out: { spieler_id: string; chat_id: number }[] = [];
  for (const m of stamm ?? []) {
    const chat = (m as any).spieler?.telegram_chat_id;
    if (chat && aktiv.has((m as any).spieler_id)) {
      out.push({ spieler_id: (m as any).spieler_id, chat_id: Number(chat) });
    }
  }
  return out;
}

async function sendeFrage(
  admin: SupabaseClient,
  bot: Bot,
  chatId: number,
  spielerId: string,
  spiel: SpielInfo
): Promise<void> {
  const msg = await bot.api.sendMessage(chatId, abfrageText(spiel), {
    parse_mode: "Markdown",
    reply_markup: abfrageKeyboard(spiel.id),
  });

  // Status auf "angefragt" (nur wenn noch keine echte Antwort vorliegt)
  const { data: alt } = await admin
    .from("verfuegbarkeiten")
    .select("status")
    .eq("spiel_id", spiel.id)
    .eq("spieler_id", spielerId)
    .maybeSingle();
  const bereitsBeantwortet = ["zugesagt", "abgesagt", "unsicher"].includes(
    alt?.status ?? ""
  );
  if (!bereitsBeantwortet) {
    await admin.from("verfuegbarkeiten").upsert(
      { spiel_id: spiel.id, spieler_id: spielerId, status: "angefragt", quelle: "system" },
      { onConflict: "spiel_id,spieler_id" }
    );
  }

  await admin.from("nachrichten").insert({
    spieler_id: spielerId,
    spiel_id: spiel.id,
    richtung: "ausgehend",
    kanal: "telegram",
    typ: "abfrage",
    inhalt: abfrageText(spiel),
    telegram_message_id: msg.message_id,
  });
}

// Abfrage an EINEN Spieler — je nach eingestelltem Kanal per Telegram oder E-Mail.
export async function sendeAbfrageAnSpieler(
  admin: SupabaseClient,
  bot: Bot,
  spielId: string,
  spielerId: string
): Promise<{ ok: boolean; grund?: string }> {
  const spiel = await ladeSpiel(admin, spielId);
  if (!spiel) return { ok: false, grund: "Spiel nicht gefunden" };

  const kontakt = await ladeKontakt(admin, spielerId);
  if (!kontakt) return { ok: false, grund: "Spieler nicht gefunden" };

  const weg = wegFuerKontakt(kontakt);

  if (weg === "telegram" && kontakt.chatId) {
    await sendeFrage(admin, bot, kontakt.chatId, spielerId, spiel);
    return { ok: true };
  }
  if (weg === "email") {
    const ok = await sendeAbfrageMail(admin, kontakt, spiel);
    return ok
      ? { ok: true }
      : { ok: false, grund: "E-Mail konnte nicht gesendet werden" };
  }
  return {
    ok: false,
    grund: "Kein Kanal: weder mit Telegram gekoppelt noch E-Mail hinterlegt",
  };
}

// Alle aktiven STAMM-Spieler einer Mannschaft, die überhaupt erreichbar sind
// (Telegram gekoppelt oder E-Mail hinterlegt).
export async function erreichbareSpieler(
  admin: SupabaseClient,
  spiel: SpielInfo
): Promise<{ spieler_id: string }[]> {
  const { data: stamm } = await admin
    .from("kader_zuordnung")
    .select(
      "spieler_id, spieler:spieler_id(telegram_chat_id, email, kanal, praeferenzen)"
    )
    .eq("mannschaft_id", spiel.mannschaft_id)
    .eq("halbserie_id", spiel.halbserie_id)
    .eq("rolle", "stamm");

  const { data: kader } = await admin
    .from("kader_status")
    .select("spieler_id, status")
    .eq("halbserie_id", spiel.halbserie_id);
  const aktiv = new Set(
    (kader ?? [])
      .filter((k: any) => k.status === "aktiv")
      .map((k: any) => k.spieler_id)
  );

  const out: { spieler_id: string }[] = [];
  for (const z of (stamm ?? []) as any[]) {
    if (!aktiv.has(z.spieler_id)) continue;
    const s = z.spieler ?? {};
    if (
      wegFuer({
        email: s.email,
        telegram_chat_id: s.telegram_chat_id,
        kanal: s.kanal,
        keineMails: keineMailsGewuenscht(s.praeferenzen),
      }) === "keiner"
    )
      continue;
    out.push({ spieler_id: z.spieler_id });
  }
  return out;
}

// Abfrage an ALLE erreichbaren, aktiven Stammspieler einer Mannschaft
// (je Spieler per Telegram oder E-Mail).
export async function sendeAbfrageFuerSpiel(
  admin: SupabaseClient,
  bot: Bot,
  spielId: string
): Promise<number> {
  const spiel = await ladeSpiel(admin, spielId);
  if (!spiel) return 0;
  const spieler = await erreichbareSpieler(admin, spiel);
  let n = 0;
  for (const s of spieler) {
    try {
      const res = await sendeAbfrageAnSpieler(admin, bot, spielId, s.spieler_id);
      if (res.ok) n++;
    } catch {
      // einzelne Fehlschläge (z. B. Bot blockiert) überspringen
    }
  }
  return n;
}
