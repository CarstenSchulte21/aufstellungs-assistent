import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdmin } from "@/lib/supabase/admin";
import { getBot, ensureInit } from "@/lib/telegram/bot";
import { ersatzKeyboard, ersatzText } from "@/lib/telegram/abfrage";
import {
  ladeKontakt,
  wegFuerKontakt,
  istErsteMail,
  spielBeschreibung,
} from "@/lib/benachrichtigung";
import {
  sendeMail,
  mailLayout,
  mailAbsatz,
  mailButton,
  mailErstkontakt,
  appUrl,
  MAIL_GRUEN,
  MAIL_ROT,
} from "@/lib/mail";
import { baueAntwortToken } from "@/lib/antwortToken";

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
      "id, spieltag_nr, datum, uhrzeit, heim, gegner, mannschaft_id, halbserie_id, mannschaften:mannschaft_id(name)"
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

  // Versand je nach Kanal (Telegram oder E-Mail)
  const kontakt = await ladeKontakt(admin, spieler_id);
  const weg = wegFuerKontakt(kontakt);

  if (weg === "keiner") {
    return NextResponse.json({
      ok: true,
      gesendet: false,
      hinweis:
        "Anfrage freigegeben, aber " +
        (kontakt?.name ?? "der Spieler") +
        " ist auf keinem Kanal erreichbar — bitte manuell anfragen.",
    });
  }

  const info = {
    spieltag_nr: (spiel as any).spieltag_nr,
    datum: (spiel as any).datum,
    uhrzeit: (spiel as any).uhrzeit ?? null,
    heim: (spiel as any).heim,
    gegner: (spiel as any).gegner,
    teamName: (spiel as any).mannschaften?.name ?? "Mannschaft",
  };
  const fristBis = new Date(Date.now() + stunden * 3600_000).toISOString();

  try {
    if (weg === "telegram" && kontakt?.chatId) {
      const bot = getBot();
      await ensureInit(bot);
      const msg = await bot.api.sendMessage(
        kontakt.chatId,
        ersatzText(info) + `\n\n_Bitte bis in ${stunden} h antworten._`,
        { parse_mode: "Markdown", reply_markup: ersatzKeyboard(anfrage.id) }
      );
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
    } else if (weg === "email" && kontakt) {
      const basis = appUrl();
      const link = (a: "zugesagt" | "abgesagt") =>
        `${basis}/antwort?t=${baueAntwortToken(spieler_id, spiel_id, a)}`;
      const erste = await istErsteMail(admin, spieler_id);
      const html = mailLayout(
        (erste ? mailErstkontakt() : "") +
          mailAbsatz(`<strong>Ersatz gesucht</strong> — die ${info.teamName} braucht dich!`) +
          mailAbsatz(spielBeschreibung(info)) +
          mailAbsatz(`Kannst du aushelfen? Bitte innerhalb von ${stunden} Stunden antworten:`) +
          mailButton(link("zugesagt"), "✅ Ich helfe aus", MAIL_GRUEN) +
          mailButton(link("abgesagt"), "❌ Diesmal nicht", MAIL_ROT)
      );
      const ok = await sendeMail({
        an: kontakt.email as string,
        name: kontakt.name,
        betreff: `Ersatz gesucht: ${info.teamName} — ${spielBeschreibung(info)}`,
        html,
      });
      if (!ok)
        return NextResponse.json({
          ok: true,
          gesendet: false,
          hinweis: "Freigegeben, aber die E-Mail konnte nicht gesendet werden.",
        });
      await admin.from("nachrichten").insert({
        spieler_id,
        spiel_id,
        ersatzanfrage_id: anfrage.id,
        richtung: "ausgehend",
        kanal: "email",
        typ: "ersatzanfrage",
        inhalt: `Ersatzanfrage per E-Mail: ${spielBeschreibung(info)}`,
      });
    }

    await admin
      .from("ersatzanfragen")
      .update({ status: "gesendet", gesendet_am: new Date().toISOString(), frist_bis: fristBis })
      .eq("id", anfrage.id);
    return NextResponse.json({ ok: true, gesendet: true });
  } catch (e) {
    return NextResponse.json({
      ok: true,
      gesendet: false,
      hinweis: "Freigegeben, aber Bot-Versand fehlgeschlagen: " + (e instanceof Error ? e.message : String(e)),
    });
  }
}
