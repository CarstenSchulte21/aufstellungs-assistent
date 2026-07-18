import { Bot } from "grammy";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdmin } from "@/lib/supabase/admin";
import {
  ANTWORT_STATUS,
  abfrageKeyboard,
  abfrageText,
  statusLabel,
  upsertVerfuegbarkeit,
  ladeSpiel,
  ersatzKeyboard,
  ersatzText,
} from "./abfrage";
import { classifyAntwort } from "./classify";

// Nächstes anstehendes Spiel eines Spielers (für Freitext-Zuordnung).
async function findNextSpiel(
  admin: SupabaseClient,
  spielerId: string
): Promise<string | null> {
  const { data: hs } = await admin
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();
  if (!hs) return null;
  const { data: stamm } = await admin
    .from("kader_zuordnung")
    .select("mannschaft_id")
    .eq("spieler_id", spielerId)
    .eq("halbserie_id", hs.id)
    .eq("rolle", "stamm")
    .maybeSingle();
  if (!stamm) return null;
  const heute = new Date().toISOString().slice(0, 10);
  const { data: spiel } = await admin
    .from("spiele")
    .select("id")
    .eq("mannschaft_id", stamm.mannschaft_id)
    .eq("halbserie_id", hs.id)
    .gte("datum", heute)
    .order("datum", { ascending: true })
    .limit(1)
    .maybeSingle();
  return spiel?.id ?? null;
}

let _bot: Bot | null = null;
let _initPromise: Promise<void> | null = null;

export function getBot(): Bot {
  if (_bot) return _bot;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN fehlt");
  const bot = new Bot(token);
  registerHandlers(bot);
  _bot = bot;
  return bot;
}

// grammY braucht im Webhook-Modus botInfo -> einmal initialisieren und cachen.
export async function ensureInit(bot: Bot): Promise<void> {
  if (!_initPromise) _initPromise = bot.init();
  await _initPromise;
}

function registerHandlers(bot: Bot) {
  // /start <token> — Kopplung von Telegram-Chat und Spieler
  bot.command("start", async (ctx) => {
    const token = (ctx.match || "").trim();
    const chatId = ctx.chat.id;
    if (!token) {
      await ctx.reply(
        "Hallo! 🏓 Bitte öffne deinen persönlichen Verbindungs-Link aus der Webapp, damit ich dich zuordnen kann."
      );
      return;
    }
    const admin = getAdmin();
    try {
      const { data: row } = await admin
        .from("telegram_koppel_tokens")
        .select("spieler_id, eingeloest_am")
        .eq("token", token)
        .maybeSingle();

      if (!row) {
        await ctx.reply(
          "Dieser Verbindungs-Link ist ungültig. Bitte hol dir in der Webapp einen neuen."
        );
        return;
      }

      await admin
        .from("spieler")
        .update({ telegram_chat_id: chatId, kanal: "telegram" })
        .eq("id", row.spieler_id);
      await admin
        .from("telegram_koppel_tokens")
        .update({ eingeloest_am: new Date().toISOString() })
        .eq("token", token);

      const { data: sp } = await admin
        .from("spieler")
        .select("name")
        .eq("id", row.spieler_id)
        .maybeSingle();

      await ctx.reply(
        `Verbunden! Hallo ${sp?.name ?? ""} 👋\n` +
          `Ab jetzt bekommst du deine Spieltag-Abfragen hier. Antworte einfach mit den Buttons.`
      );
    } catch {
      await ctx.reply("Da ist etwas schiefgelaufen. Bitte versuch es später erneut.");
    }
  });

  // Antwort-Buttons: callback_data = v:<spielId>:<antwort>
  bot.callbackQuery(/^v:/, async (ctx) => {
    const parts = (ctx.callbackQuery.data || "").split(":");
    const spielId = parts[1];
    const antwort = parts[2];
    const status = ANTWORT_STATUS[antwort];
    const chatId = ctx.chat?.id;

    if (!spielId || !status || !chatId) {
      await ctx.answerCallbackQuery({ text: "Ungültige Antwort." });
      return;
    }

    const admin = getAdmin();
    const { data: sp } = await admin
      .from("spieler")
      .select("id")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();

    if (!sp) {
      await ctx.answerCallbackQuery({
        text: "Du bist noch nicht verbunden. Bitte nutze deinen Link aus der Webapp.",
        show_alert: true,
      });
      return;
    }

    await upsertVerfuegbarkeit(admin, spielId, sp.id, status, "telegram_button");
    await admin.from("nachrichten").insert({
      spieler_id: sp.id,
      spiel_id: spielId,
      richtung: "eingehend",
      kanal: "telegram",
      typ: "bestaetigung",
      inhalt: `Antwort: ${status}`,
    });

    await ctx.answerCallbackQuery({ text: "Gespeichert ✓" });
    try {
      // Ursprungsnachricht (mit Spieltag-Details) erhalten, nur Antwort ergänzen
      const info = await ladeSpiel(admin, spielId);
      const kopf = info ? abfrageText(info) : "Spieltag-Abfrage";
      await ctx.editMessageText(
        `${kopf}\n\n➡️ *Deine Antwort: ${statusLabel(status)}*\n_Doch anders? Einfach neu tippen._`,
        { parse_mode: "Markdown", reply_markup: abfrageKeyboard(spielId) }
      );
    } catch {
      // Nachricht evtl. unverändert -> ignorieren
    }
  });

  // Ersatzanfrage-Antwort: callback_data = e:<anfrageId>:<ja|nein>
  bot.callbackQuery(/^e:/, async (ctx) => {
    const parts = (ctx.callbackQuery.data || "").split(":");
    const anfrageId = parts[1];
    const antwort = parts[2];
    const chatId = ctx.chat?.id;
    if (!anfrageId || !antwort || !chatId) {
      await ctx.answerCallbackQuery({ text: "Ungültig." });
      return;
    }
    const admin = getAdmin();
    const { data: sp } = await admin
      .from("spieler")
      .select("id")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();
    const { data: anfrage } = await admin
      .from("ersatzanfragen")
      .select("id, spiel_id, spieler_id, status")
      .eq("id", anfrageId)
      .maybeSingle();

    if (!sp || !anfrage || (anfrage as any).spieler_id !== sp.id) {
      await ctx.answerCallbackQuery({ text: "Diese Anfrage gehört nicht zu dir." });
      return;
    }
    // Antwort (auch nachträgliche Änderung) erlaubt, solange nicht final
    if (
      !["gesendet", "freigegeben", "zugesagt", "abgelehnt"].includes(
        (anfrage as any).status
      )
    ) {
      await ctx.answerCallbackQuery({
        text: "Diese Anfrage ist nicht mehr änderbar (bereits eingeplant oder abgelaufen).",
        show_alert: true,
      });
      return;
    }

    const neu = antwort === "ja" ? "zugesagt" : "abgelehnt";
    await admin
      .from("ersatzanfragen")
      .update({ status: neu, beantwortet_am: new Date().toISOString() })
      .eq("id", anfrageId);

    await admin.from("verfuegbarkeiten").upsert(
      {
        spiel_id: (anfrage as any).spiel_id,
        spieler_id: sp.id,
        status: antwort === "ja" ? "zugesagt" : "abgesagt",
        quelle: "telegram_button",
      },
      { onConflict: "spiel_id,spieler_id" }
    );
    await admin.from("nachrichten").insert({
      spieler_id: sp.id,
      spiel_id: (anfrage as any).spiel_id,
      ersatzanfrage_id: anfrageId,
      richtung: "eingehend",
      kanal: "telegram",
      typ: "bestaetigung",
      inhalt: "Ersatz-Antwort: " + neu,
    });

    await ctx.answerCallbackQuery({ text: "Danke!" });
    try {
      const info = await ladeSpiel(admin, (anfrage as any).spiel_id);
      const kopf = info ? ersatzText(info) : "Ersatzanfrage";
      const antwortZeile =
        antwort === "ja"
          ? "➡️ *Deine Antwort: Ich helfe aus ✅*\n_Der Mannschaftsführer plant dich final ein. Doch anders? Einfach neu tippen._"
          : "➡️ *Deine Antwort: Diesmal nicht ❌*\n_Doch anders? Einfach neu tippen._";
      await ctx.editMessageText(`${kopf}\n\n${antwortZeile}`, {
        parse_mode: "Markdown",
        reply_markup: ersatzKeyboard(anfrageId),
      });
    } catch {
      // ignorieren
    }
  });

  // /status — zeigt, ob und als wer man verbunden ist
  bot.command("status", async (ctx) => {
    const admin = getAdmin();
    const { data: sp } = await admin
      .from("spieler")
      .select("name")
      .eq("telegram_chat_id", ctx.chat.id)
      .maybeSingle();
    await ctx.reply(
      sp
        ? `Du bist verbunden als ${sp.name}. ✅`
        : "Du bist noch nicht verbunden. Öffne deinen Link aus der Webapp."
    );
  });

  // Freitext (kein Kommando) -> per Claude klassifizieren, dann rückbestätigen.
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text ?? "";
    if (text.startsWith("/")) return; // Kommandos ignorieren

    const admin = getAdmin();
    const { data: sp } = await admin
      .from("spieler")
      .select("id")
      .eq("telegram_chat_id", ctx.chat.id)
      .maybeSingle();
    if (!sp) {
      await ctx.reply(
        "Du bist noch nicht verbunden. Öffne deinen Link aus der Webapp."
      );
      return;
    }

    const spielId = await findNextSpiel(admin, sp.id);
    if (!spielId) {
      await ctx.reply("Ich sehe gerade keinen anstehenden Spieltag für dich.");
      return;
    }

    await admin.from("nachrichten").insert({
      spieler_id: sp.id,
      spiel_id: spielId,
      richtung: "eingehend",
      kanal: "telegram",
      typ: "abfrage",
      inhalt: text,
    });

    const klass = await classifyAntwort(text);
    const info = await ladeSpiel(admin, spielId);
    const spielRef = info ? ` für Spieltag ${info.spieltag_nr} (${info.gegner})` : "";

    if (klass === "unklar") {
      await ctx.reply(
        `Das habe ich nicht sicher verstanden 🤔 — bitte tippe zur Antwort${spielRef}:`,
        { reply_markup: abfrageKeyboard(spielId) }
      );
      return;
    }

    const status =
      klass === "ja" ? "zugesagt" : klass === "nein" ? "abgesagt" : "unsicher";
    await ctx.reply(
      `Verstanden als *${statusLabel(status)}*${spielRef} — korrekt?\n` +
        `Zur Bestätigung tippen (nichts wird ohne deinen Klick gespeichert):`,
      { parse_mode: "Markdown", reply_markup: abfrageKeyboard(spielId) }
    );
  });
}
