import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdmin } from "@/lib/supabase/admin";
import { getBot, ensureInit } from "@/lib/telegram/bot";
import { ersatzKeyboard, ersatzText } from "@/lib/telegram/abfrage";

export const dynamic = "force-dynamic";

// MF/Admin gibt einen Ersatzkandidaten frei -> Ersatzanfrage anlegen und
// (falls gekoppelt) per Bot mit Frist versenden. Der Lock (DB-Index) verhindert
// eine zweite offene Anfrage für denselben Spieler am selben Tag.
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { spiel_id, spieler_id } = await req.json().catch(() => ({}));
  if (!spiel_id || !spieler_id)
    return NextResponse.json({ error: "spiel_id/spieler_id fehlt" }, { status: 400 });

  const admin = getAdmin();
  const { data: spiel } = await admin
    .from("spiele")
    .select(
      "id, spieltag_nr, datum, heim, gegner, mannschaft_id, halbserie_id, mannschaften:mannschaft_id(name)"
    )
    .eq("id", spiel_id)
    .maybeSingle();
  if (!spiel) return NextResponse.json({ error: "Spiel nicht gefunden" }, { status: 404 });

  // Nur Admin oder MF der betroffenen Mannschaft
  if (!session.isAdmin && !session.mfTeams.includes((spiel as any).mannschaft_id))
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });

  // Frist aus Regelkonfiguration
  const { data: cfg } = await admin
    .from("regel_config")
    .select("config")
    .eq("mannschaft_id", (spiel as any).mannschaft_id)
    .eq("halbserie_id", (spiel as any).halbserie_id)
    .maybeSingle();
  const stunden = Number((cfg?.config as any)?.ersatz_antwortfrist_stunden ?? 48);

  // Ersatzanfrage anlegen (Lock greift hier)
  const { data: anfrage, error } = await admin
    .from("ersatzanfragen")
    .insert({
      spiel_id,
      spieler_id,
      spiel_datum: (spiel as any).datum,
      rang: 0,
      status: "freigegeben",
      freigegeben_von: session.userId,
      freigegeben_am: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !anfrage) {
    const lock = /ersatz_lock|duplicate key/.test(error?.message ?? "");
    return NextResponse.json(
      {
        error: lock
          ? "Dieser Spieler ist am selben Tag bereits angefragt (Lock aktiv)."
          : "Anfrage konnte nicht angelegt werden: " + (error?.message ?? ""),
      },
      { status: lock ? 409 : 500 }
    );
  }

  // Bot-Versand (nur wenn gekoppelt)
  const { data: sp } = await admin
    .from("spieler")
    .select("telegram_chat_id, name")
    .eq("id", spieler_id)
    .maybeSingle();

  if (!sp?.telegram_chat_id) {
    return NextResponse.json({
      ok: true,
      gesendet: false,
      hinweis:
        "Anfrage freigegeben, aber " +
        (sp?.name ?? "der Spieler") +
        " ist nicht mit Telegram gekoppelt — bitte manuell anfragen.",
    });
  }

  const info = {
    spieltag_nr: (spiel as any).spieltag_nr,
    datum: (spiel as any).datum,
    heim: (spiel as any).heim,
    gegner: (spiel as any).gegner,
    teamName: (spiel as any).mannschaften?.name ?? "Mannschaft",
  };
  const fristBis = new Date(Date.now() + stunden * 3600_000).toISOString();

  try {
    const bot = getBot();
    await ensureInit(bot);
    const msg = await bot.api.sendMessage(
      Number(sp.telegram_chat_id),
      ersatzText(info) + `\n\n_Bitte bis in ${stunden} h antworten._`,
      { parse_mode: "Markdown", reply_markup: ersatzKeyboard(anfrage.id) }
    );
    await admin
      .from("ersatzanfragen")
      .update({ status: "gesendet", gesendet_am: new Date().toISOString(), frist_bis: fristBis })
      .eq("id", anfrage.id);
    await admin.from("nachrichten").insert({
      spieler_id,
      spiel_id,
      ersatzanfrage_id: anfrage.id,
      richtung: "ausgehend",
      kanal: "telegram",
      typ: "ersatzanfrage",
      inhalt: ersatzText(info),
      telegram_message_id: msg.message_id,
    });
    return NextResponse.json({ ok: true, gesendet: true });
  } catch (e) {
    return NextResponse.json({
      ok: true,
      gesendet: false,
      hinweis: "Freigegeben, aber Bot-Versand fehlgeschlagen: " + (e instanceof Error ? e.message : String(e)),
    });
  }
}
