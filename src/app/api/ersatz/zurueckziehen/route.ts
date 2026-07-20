import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdmin } from "@/lib/supabase/admin";
import { getBot, ensureInit } from "@/lib/telegram/bot";

export const dynamic = "force-dynamic";

function fmtDatum(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

// Zieht eine Ersatzanfrage zurück bzw. hebt eine Einplanung wieder auf:
// Anfrage -> zurueckgezogen, Tages-Lock frei, Zusage entfernt, ggf. Einsatz
// zurückgebucht, Spieler wird informiert.
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { ersatzanfrage_id } = await req.json().catch(() => ({}));
  if (!ersatzanfrage_id)
    return NextResponse.json({ error: "ersatzanfrage_id fehlt" }, { status: 400 });

  const admin = getAdmin();
  const { data: anfrage } = await admin
    .from("ersatzanfragen")
    .select("id, spiel_id, spieler_id, status")
    .eq("id", ersatzanfrage_id)
    .maybeSingle();
  if (!anfrage)
    return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });

  const alterStatus = (anfrage as any).status as string;
  if (
    !["freigegeben", "gesendet", "zugesagt", "eingeplant"].includes(alterStatus)
  )
    return NextResponse.json(
      { error: "Diese Anfrage lässt sich nicht mehr zurückziehen." },
      { status: 409 }
    );

  const { data: spiel } = await admin
    .from("spiele")
    .select(
      "id, spieltag_nr, datum, uhrzeit, heim, gegner, mannschaft_id, mannschaften:mannschaft_id(name)"
    )
    .eq("id", (anfrage as any).spiel_id)
    .maybeSingle();
  if (!spiel)
    return NextResponse.json({ error: "Spiel nicht gefunden" }, { status: 404 });

  if (!session.isAdmin && !session.mfTeams.includes((spiel as any).mannschaft_id))
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });

  const warEingeplant = alterStatus === "eingeplant";

  await admin
    .from("ersatzanfragen")
    .update({
      status: "zurueckgezogen",
      beantwortet_am: new Date().toISOString(),
    })
    .eq("id", ersatzanfrage_id);

  // Zusage für dieses Spiel entfernen — der Spieler zählt nicht mehr mit.
  await admin
    .from("verfuegbarkeiten")
    .delete()
    .eq("spiel_id", (spiel as any).id)
    .eq("spieler_id", (anfrage as any).spieler_id);

  // Einsatz zurückbuchen, falls er schon verbucht war
  if (warEingeplant) {
    await admin
      .from("einsaetze")
      .delete()
      .eq("spiel_id", (spiel as any).id)
      .eq("spieler_id", (anfrage as any).spieler_id);
  }

  await admin.from("audit_log").insert({
    benutzer_id: session.userId,
    aktion: warEingeplant ? "einplanung_aufgehoben" : "ersatz_zurueckgezogen",
    entitaet: "ersatzanfragen",
    entitaet_id: ersatzanfrage_id,
    details: {
      spiel_id: (spiel as any).id,
      spieler_id: (anfrage as any).spieler_id,
      alter_status: alterStatus,
    },
  });

  // Spieler informieren (falls gekoppelt)
  let benachrichtigt = false;
  try {
    const { data: sp } = await admin
      .from("spieler")
      .select("telegram_chat_id")
      .eq("id", (anfrage as any).spieler_id)
      .maybeSingle();
    if (sp?.telegram_chat_id) {
      const ha = (spiel as any).heim ? "Heim" : "Auswärts";
      const teamName = (spiel as any).mannschaften?.name ?? "Mannschaft";
      const wann = `${fmtDatum((spiel as any).datum)}${
        (spiel as any).uhrzeit ? ` · ${String((spiel as any).uhrzeit).slice(0, 5)} Uhr` : ""
      } · ${ha} gegen ${(spiel as any).gegner}`;
      const text = warEingeplant
        ? `ℹ️ *Einplanung aufgehoben*\n${teamName}: ${wann}.\nDu wirst doch nicht gebraucht — danke dir trotzdem! 🏓`
        : `ℹ️ *Anfrage zurückgezogen*\n${teamName}: ${wann}.\nDie Ersatzanfrage hat sich erledigt — du musst nichts weiter tun.`;
      const bot = getBot();
      await ensureInit(bot);
      await bot.api.sendMessage(Number(sp.telegram_chat_id), text, {
        parse_mode: "Markdown",
      });
      await admin.from("nachrichten").insert({
        spieler_id: (anfrage as any).spieler_id,
        spiel_id: (spiel as any).id,
        ersatzanfrage_id,
        richtung: "ausgehend",
        kanal: "telegram",
        typ: "bestaetigung",
        inhalt: warEingeplant ? "Einplanung aufgehoben" : "Anfrage zurückgezogen",
      });
      benachrichtigt = true;
    }
  } catch {
    // Benachrichtigung ist optional
  }

  return NextResponse.json({ ok: true, warEingeplant, benachrichtigt });
}
