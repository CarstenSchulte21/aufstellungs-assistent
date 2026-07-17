import { InlineKeyboard, type Bot } from "grammy";
import type { SupabaseClient } from "@supabase/supabase-js";

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

function fmtDatum(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

export function abfrageText(spiel: {
  spieltag_nr: number;
  datum: string;
  heim: boolean;
  gegner: string;
  teamName: string;
}): string {
  const ha = spiel.heim ? "Heim" : "Auswärts";
  return (
    `🏓 *Spieltag ${spiel.spieltag_nr}* der ${spiel.teamName}\n` +
    `${fmtDatum(spiel.datum)} · ${ha} gegen ${spiel.gegner}\n\n` +
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
      "id, spieltag_nr, datum, heim, gegner, mannschaft_id, halbserie_id, mannschaften:mannschaft_id(name)"
    )
    .eq("id", spielId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    spieltag_nr: data.spieltag_nr,
    datum: data.datum,
    heim: data.heim,
    gegner: data.gegner,
    mannschaft_id: data.mannschaft_id,
    halbserie_id: data.halbserie_id,
    teamName: (data as any).mannschaften?.name ?? "Mannschaft",
  };
}

// Gekoppelte, aktive Spieler einer Mannschaft (mit Telegram-Chat).
export async function gekoppelteSpieler(
  admin: SupabaseClient,
  spiel: SpielInfo
): Promise<{ spieler_id: string; chat_id: number }[]> {
  const { data: meld } = await admin
    .from("meldungen")
    .select("spieler_id, spieler:spieler_id(telegram_chat_id)")
    .eq("mannschaft_id", spiel.mannschaft_id)
    .eq("halbserie_id", spiel.halbserie_id);

  const { data: kader } = await admin
    .from("kader_status")
    .select("spieler_id, status")
    .eq("halbserie_id", spiel.halbserie_id);
  const aktiv = new Set(
    (kader ?? []).filter((k: any) => k.status === "aktiv").map((k: any) => k.spieler_id)
  );

  const out: { spieler_id: string; chat_id: number }[] = [];
  for (const m of meld ?? []) {
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

// Abfrage an EINEN Spieler (für Testabfrage aus der Webapp).
export async function sendeAbfrageAnSpieler(
  admin: SupabaseClient,
  bot: Bot,
  spielId: string,
  spielerId: string
): Promise<{ ok: boolean; grund?: string }> {
  const spiel = await ladeSpiel(admin, spielId);
  if (!spiel) return { ok: false, grund: "Spiel nicht gefunden" };
  const { data: sp } = await admin
    .from("spieler")
    .select("telegram_chat_id")
    .eq("id", spielerId)
    .maybeSingle();
  if (!sp?.telegram_chat_id)
    return { ok: false, grund: "Spieler ist nicht mit Telegram gekoppelt" };
  await sendeFrage(admin, bot, Number(sp.telegram_chat_id), spielerId, spiel);
  return { ok: true };
}

// Abfrage an ALLE gekoppelten, aktiven Spieler einer Mannschaft (Scheduler).
export async function sendeAbfrageFuerSpiel(
  admin: SupabaseClient,
  bot: Bot,
  spielId: string
): Promise<number> {
  const spiel = await ladeSpiel(admin, spielId);
  if (!spiel) return 0;
  const spieler = await gekoppelteSpieler(admin, spiel);
  let n = 0;
  for (const s of spieler) {
    try {
      await sendeFrage(admin, bot, s.chat_id, s.spieler_id, spiel);
      n++;
    } catch {
      // einzelne Fehlschläge (z. B. Bot blockiert) überspringen
    }
  }
  return n;
}
