import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdmin } from "@/lib/supabase/admin";
import { getBot, ensureInit } from "@/lib/telegram/bot";

export const dynamic = "force-dynamic";

// Erzeugt einen persönlichen Kopplungs-Deeplink für einen Spieler (nur MF/Admin).
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session || (!session.isAdmin && !session.isMf)) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { spieler_id } = await req.json().catch(() => ({}));
  if (!spieler_id) {
    return NextResponse.json({ error: "spieler_id fehlt" }, { status: 400 });
  }

  const admin = getAdmin();
  const { data: token, error } = await admin
    .from("telegram_koppel_tokens")
    .insert({ spieler_id })
    .select("token")
    .single();
  if (error || !token) {
    return NextResponse.json({ error: "Token konnte nicht erstellt werden" }, { status: 500 });
  }

  const bot = getBot();
  await ensureInit(bot);
  const me = await bot.api.getMe();
  const link = `https://t.me/${me.username}?start=${token.token}`;

  return NextResponse.json({ link });
}
