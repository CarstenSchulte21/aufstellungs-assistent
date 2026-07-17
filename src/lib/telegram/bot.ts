import { Bot } from "grammy";
import { getAdmin } from "@/lib/supabase/admin";
import {
  ANTWORT_STATUS,
  abfrageKeyboard,
  statusLabel,
  upsertVerfuegbarkeit,
} from "./abfrage";

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
      await ctx.editMessageText(
        `Deine Antwort: *${statusLabel(status)}*\n\nDoch anders? Tippe einfach neu.`,
        { parse_mode: "Markdown", reply_markup: abfrageKeyboard(spielId) }
      );
    } catch {
      // Nachricht evtl. unverändert -> ignorieren
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
}
