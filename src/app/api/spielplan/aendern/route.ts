import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdmin } from "@/lib/supabase/admin";
import { getBot, ensureInit } from "@/lib/telegram/bot";
import { ladeSpiel, gekoppelteSpieler, sendeAbfrageAnSpieler } from "@/lib/telegram/abfrage";
import { ladeStammIds } from "@/lib/kader";

export const dynamic = "force-dynamic";

function fmtDatum(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Chat-IDs aller Spieler, die für dieses Spiel schon involviert sind
// (angefragt/zugesagt/…), zur Benachrichtigung.
async function betroffeneChats(
  admin: ReturnType<typeof getAdmin>,
  spielId: string
): Promise<number[]> {
  const { data } = await admin
    .from("verfuegbarkeiten")
    .select("status, spieler:spieler_id(telegram_chat_id)")
    .eq("spiel_id", spielId)
    .neq("status", "nicht_angefragt");
  const set = new Set<number>();
  for (const v of data ?? []) {
    const chat = (v as any).spieler?.telegram_chat_id;
    if (chat) set.add(Number(chat));
  }
  return Array.from(set);
}

async function sendeInfo(bot: any, chats: number[], text: string): Promise<void> {
  for (const chat of chats) {
    try {
      await bot.api.sendMessage(chat, text, { parse_mode: "Markdown" });
    } catch {
      // einzelne Fehler nicht weiterreichen
    }
  }
}

export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { spiel_id, typ } = body as {
    spiel_id?: string;
    typ?: "verlegen" | "heimrecht" | "absetzen";
  };
  if (!spiel_id || !["verlegen", "heimrecht", "absetzen"].includes(typ ?? ""))
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });

  const admin = getAdmin();
  const { data: spiel } = await admin
    .from("spiele")
    .select(
      "id, mannschaft_id, halbserie_id, datum, uhrzeit, ort, heim, gegner, status, verlegt_von, mannschaften:mannschaft_id(name)"
    )
    .eq("id", spiel_id)
    .maybeSingle();
  if (!spiel) return NextResponse.json({ error: "Spiel nicht gefunden" }, { status: 404 });

  const teamMid = (spiel as any).mannschaft_id;
  if (!session.isAdmin && !session.mfTeams.includes(teamMid))
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });

  const teamName = (spiel as any).mannschaften?.name ?? "Mannschaft";
  const gegner = (spiel as any).gegner ?? "";

  const bot = getBot();
  await ensureInit(bot);

  // ── Verlegen ─────────────────────────────────────────────────────────────
  if (typ === "verlegen") {
    const neuesDatum: string = body.datum || (spiel as any).datum;
    const neueUhrzeit: string | null = body.uhrzeit ?? (spiel as any).uhrzeit;
    const datumGeaendert = neuesDatum !== (spiel as any).datum;

    // Status bleibt 'geplant' (das Spiel findet statt), damit Erstabfrage/
    // Reminder normal weiterlaufen. Die Verlegung wird über verlegt_von markiert.
    await admin
      .from("spiele")
      .update({
        datum: neuesDatum,
        uhrzeit: neueUhrzeit,
        verlegt_von: datumGeaendert ? (spiel as any).datum : (spiel as any).verlegt_von,
        zuletzt_geaendert_am: new Date().toISOString(),
        zuletzt_geaendert_art: datumGeaendert ? "verlegt" : "uhrzeit",
      })
      .eq("id", spiel_id);

    await admin.from("audit_log").insert({
      aktion: "spiel_verlegt",
      entitaet: "spiele",
      entitaet_id: spiel_id,
      details: {
        von: (spiel as any).datum,
        nach: neuesDatum,
        uhrzeit: neueUhrzeit,
        durch: session.userId,
      },
    });

    if (!datumGeaendert) {
      // Nur Uhrzeit geändert → Zusagen bleiben, nur informieren
      const chats = await betroffeneChats(admin, spiel_id);
      await sendeInfo(
        bot,
        chats,
        `🕒 *Uhrzeit geändert* — ${teamName} gegen ${gegner} am ${fmtDatum(
          neuesDatum
        )} beginnt jetzt um *${(neueUhrzeit ?? "").slice(0, 5)} Uhr*.`
      );
      return NextResponse.json({ ok: true, neuAbgefragt: 0, informiert: chats.length });
    }

    // Echter Terminwechsel → Zusagen zurücksetzen und neu abfragen
    await admin.from("verfuegbarkeiten").delete().eq("spiel_id", spiel_id);

    // Abwesenheiten für den neuen Termin anwenden (Stamm)
    const stammIds = await ladeStammIds(admin, (spiel as any).halbserie_id, teamMid);
    const abgesagt = new Set<string>();
    if (stammIds.length > 0) {
      const { data: abw } = await admin
        .from("abwesenheiten")
        .select("spieler_id")
        .in("spieler_id", stammIds)
        .lte("von", neuesDatum)
        .gte("bis", neuesDatum);
      for (const a of abw ?? []) abgesagt.add((a as any).spieler_id);
      if (abgesagt.size > 0) {
        await admin.from("verfuegbarkeiten").insert(
          Array.from(abgesagt).map((sid) => ({
            spiel_id,
            spieler_id: sid,
            status: "abgesagt",
            quelle: "system",
            kommentar: "Abwesenheit",
          }))
        );
      }
    }

    // Neu abfragen: gekoppelte, aktive Stammspieler, die nicht abwesend sind
    const info = await ladeSpiel(admin, spiel_id);
    let neuAbgefragt = 0;
    if (info) {
      const empfaenger = await gekoppelteSpieler(admin, info);
      for (const e of empfaenger) {
        if (abgesagt.has(e.spieler_id)) continue;
        const res = await sendeAbfrageAnSpieler(admin, bot, spiel_id, e.spieler_id);
        if (res.ok) neuAbgefragt++;
      }
    }
    return NextResponse.json({ ok: true, verlegt: true, neuAbgefragt });
  }

  // ── Heimrecht / Ort ──────────────────────────────────────────────────────
  if (typ === "heimrecht") {
    const neuHeim: boolean =
      typeof body.heim === "boolean" ? body.heim : !(spiel as any).heim;
    const neuOrt: string | null = body.ort ?? (spiel as any).ort;
    await admin
      .from("spiele")
      .update({
        heim: neuHeim,
        ort: neuOrt,
        zuletzt_geaendert_am: new Date().toISOString(),
        zuletzt_geaendert_art: "heimrecht",
      })
      .eq("id", spiel_id);
    await admin.from("audit_log").insert({
      aktion: "spiel_heimrecht",
      entitaet: "spiele",
      entitaet_id: spiel_id,
      details: { heim: neuHeim, ort: neuOrt, durch: session.userId },
    });
    const chats = await betroffeneChats(admin, spiel_id);
    await sendeInfo(
      bot,
      chats,
      `🔁 *Heimrecht geändert* — ${teamName} gegen ${gegner} am ${fmtDatum(
        (spiel as any).datum
      )} ist jetzt ein *${neuHeim ? "Heimspiel" : "Auswärtsspiel"}*${
        neuOrt ? ` (Ort: ${neuOrt})` : ""
      }.`
    );
    return NextResponse.json({ ok: true, informiert: chats.length });
  }

  // ── Absetzen / Ausfall ───────────────────────────────────────────────────
  if (typ === "absetzen") {
    await admin
      .from("spiele")
      .update({
        status: "abgesetzt",
        zuletzt_geaendert_am: new Date().toISOString(),
        zuletzt_geaendert_art: "abgesetzt",
      })
      .eq("id", spiel_id);
    await admin.from("audit_log").insert({
      aktion: "spiel_abgesetzt",
      entitaet: "spiele",
      entitaet_id: spiel_id,
      details: { datum: (spiel as any).datum, durch: session.userId },
    });
    const chats = await betroffeneChats(admin, spiel_id);
    await sendeInfo(
      bot,
      chats,
      `⚠️ *Spiel fällt aus* — ${teamName} gegen ${gegner} am ${fmtDatum(
        (spiel as any).datum
      )} wurde abgesetzt. Du musst nicht antreten.`
    );
    return NextResponse.json({ ok: true, informiert: chats.length });
  }

  return NextResponse.json({ error: "Unbekannter Typ" }, { status: 400 });
}
