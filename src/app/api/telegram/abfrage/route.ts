import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdmin } from "@/lib/supabase/admin";
import { getBot, ensureInit } from "@/lib/telegram/bot";
import { sendeAbfrageAnSpieler } from "@/lib/telegram/abfrage";

export const dynamic = "force-dynamic";

// Sendet eine (Test-)Abfrage an einen Spieler. Ohne spiel_id wird das nächste
// anstehende Spiel seiner Mannschaft genommen. Nur MF/Admin.
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session || (!session.isAdmin && !session.isMf)) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const spielerId: string | undefined = body.spieler_id;
  let spielId: string | undefined = body.spiel_id;
  if (!spielerId) {
    return NextResponse.json({ error: "spieler_id fehlt" }, { status: 400 });
  }

  const admin = getAdmin();

  // Fallback: nächstes anstehendes Spiel der Mannschaft dieses Spielers
  if (!spielId) {
    const { data: hs } = await admin
      .from("halbserien")
      .select("id")
      .eq("aktiv", true)
      .maybeSingle();
    const { data: stamm } = await admin
      .from("kader_zuordnung")
      .select("mannschaft_id")
      .eq("spieler_id", spielerId)
      .eq("halbserie_id", hs?.id ?? "")
      .eq("rolle", "stamm")
      .maybeSingle();
    if (!stamm) {
      return NextResponse.json(
        { error: "Spieler hat in der aktiven Halbserie keinen Stammplatz" },
        { status: 400 }
      );
    }
    const heute = new Date().toISOString().slice(0, 10);
    const { data: spiel } = await admin
      .from("spiele")
      .select("id")
      .eq("mannschaft_id", stamm.mannschaft_id)
      .eq("halbserie_id", hs?.id ?? "")
      .gte("datum", heute)
      .order("datum", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!spiel) {
      return NextResponse.json(
        { error: "Kein anstehendes Spiel gefunden" },
        { status: 400 }
      );
    }
    spielId = spiel.id;
  }

  const bot = getBot();
  await ensureInit(bot);
  const res = await sendeAbfrageAnSpieler(admin, bot, spielId!, spielerId);
  if (!res.ok) {
    return NextResponse.json({ error: res.grund }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
