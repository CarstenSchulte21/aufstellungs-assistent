import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdmin } from "@/lib/supabase/admin";
import { getBot, ensureInit } from "@/lib/telegram/bot";
import { ladeKontakt, wegFuerKontakt, sendeInfoMail } from "@/lib/benachrichtigung";

export const dynamic = "force-dynamic";

function fmtDatum(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

// MF/Admin plant einen zugesagten Ersatzspieler final ein: Ersatzanfrage ->
// eingeplant, Einsatz verbuchen (ersatz=true), Verfügbarkeit auf zugesagt.
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { ersatzanfrage_id } = await req.json().catch(() => ({}));
  if (!ersatzanfrage_id)
    return NextResponse.json({ error: "ersatzanfrage_id fehlt" }, { status: 400 });

  const admin = getAdmin();
  const { data: anfrage } = await admin
    .from("ersatzanfragen")
    .select("id, spiel_id, spieler_id, status")
    .eq("id", ersatzanfrage_id)
    .maybeSingle();
  if (!anfrage) return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });

  const { data: spiel } = await admin
    .from("spiele")
    .select(
      "id, spieltag_nr, datum, heim, gegner, mannschaft_id, halbserie_id, mannschaften:mannschaft_id(name)"
    )
    .eq("id", (anfrage as any).spiel_id)
    .maybeSingle();
  if (!spiel) return NextResponse.json({ error: "Spiel nicht gefunden" }, { status: 404 });

  if (!session.isAdmin && !session.mfTeams.includes((spiel as any).mannschaft_id))
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });

  await admin
    .from("ersatzanfragen")
    .update({ status: "eingeplant" })
    .eq("id", ersatzanfrage_id);

  await admin.from("einsaetze").insert({
    halbserie_id: (spiel as any).halbserie_id,
    spieler_id: (anfrage as any).spieler_id,
    mannschaft_id: (spiel as any).mannschaft_id,
    spiel_id: (spiel as any).id,
    datum: (spiel as any).datum,
    ersatz: true,
    quelle: "system",
  });

  await admin.from("verfuegbarkeiten").upsert(
    {
      spiel_id: (spiel as any).id,
      spieler_id: (anfrage as any).spieler_id,
      status: "zugesagt",
      quelle: "admin",
    },
    { onConflict: "spiel_id,spieler_id" }
  );

  await admin.from("audit_log").insert({
    benutzer_id: session.userId,
    aktion: "ersatz_eingeplant",
    entitaet: "ersatzanfragen",
    entitaet_id: ersatzanfrage_id,
    details: { spiel_id: (spiel as any).id, spieler_id: (anfrage as any).spieler_id },
  });

  // Spieler final benachrichtigen — je nach Kanal
  let benachrichtigt = false;
  try {
    const kontakt = await ladeKontakt(admin, (anfrage as any).spieler_id);
    const ha = (spiel as any).heim ? "Heim" : "Auswärts";
    const teamName = (spiel as any).mannschaften?.name ?? "Mannschaft";
    const wann = `${fmtDatum((spiel as any).datum)} · ${ha} gegen ${
      (spiel as any).gegner
    }`;
    const weg = wegFuerKontakt(kontakt);

    if (weg === "telegram" && kontakt?.chatId) {
      const bot = getBot();
      await ensureInit(bot);
      await bot.api.sendMessage(
        kontakt.chatId,
        `✅ *Du bist fest eingeplant!*\n` +
          `Spieltag ${(spiel as any).spieltag_nr} der ${teamName}: ${wann}.\n\n` +
          `Bitte sei rechtzeitig da. Danke fürs Aushelfen! 🏓`,
        { parse_mode: "Markdown" }
      );
      await admin.from("nachrichten").insert({
        spieler_id: (anfrage as any).spieler_id,
        spiel_id: (spiel as any).id,
        ersatzanfrage_id,
        richtung: "ausgehend",
        kanal: "telegram",
        typ: "bestaetigung",
        inhalt: "Fest eingeplant",
      });
      benachrichtigt = true;
    } else if (weg === "email" && kontakt) {
      benachrichtigt = await sendeInfoMail(
        admin,
        kontakt,
        `Du bist fest eingeplant: ${teamName} — ${wann}`,
        [
          `<strong>Du bist fest eingeplant!</strong>`,
          `Spieltag ${(spiel as any).spieltag_nr} der ${teamName}: ${wann}.`,
          `Bitte sei rechtzeitig da. Danke fürs Aushelfen! 🏓`,
        ],
        (spiel as any).id
      );
    }
  } catch {
    // Benachrichtigung ist optional
  }

  return NextResponse.json({ ok: true, benachrichtigt });
}
