import { webhookCallback } from "grammy";
import { getBot, ensureInit } from "@/lib/telegram/bot";

export const dynamic = "force-dynamic";

// Telegram ruft diese Route per Webhook auf (POST).
export async function POST(req: Request): Promise<Response> {
  const bot = getBot();
  await ensureInit(bot);
  const handle = webhookCallback(bot, "std/http", {
    secretToken: process.env.TELEGRAM_WEBHOOK_SECRET,
  });
  return handle(req);
}
