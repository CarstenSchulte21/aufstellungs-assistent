import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/supabase/admin";
import { getBot, ensureInit } from "@/lib/telegram/bot";
import { cronErlaubt } from "@/lib/cron";
import { pruefeLockTimeout } from "@/lib/ersatzLock";

export const dynamic = "force-dynamic";

// Optionaler Einzelaufruf (die Logik läuft auch täglich im Reminder-Cron mit).
export async function GET(req: Request): Promise<Response> {
  if (!cronErlaubt(req))
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 401 });
  const admin = getAdmin();
  const bot = getBot();
  await ensureInit(bot);
  const abgelaufen = await pruefeLockTimeout(admin, bot);
  return NextResponse.json({ ok: true, abgelaufen });
}
