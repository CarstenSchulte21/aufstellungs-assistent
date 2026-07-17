import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/supabase/admin";
import { getBot, ensureInit } from "@/lib/telegram/bot";
import { ladeSpiel, abfrageText, abfrageKeyboard } from "@/lib/telegram/abfrage";
import { cronErlaubt, heuteBerlin } from "@/lib/cron";

export const dynamic = "force-dynamic";

// SPEC A.7 „Reminder": offene Abfragen erinnern (max. n mal), danach auf
// keine_antwort setzen und den Fall für die MF-Eskalation markieren.
export async function GET(req: Request): Promise<Response> {
  if (!cronErlaubt(req)) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 401 });
  }

  const admin = getAdmin();
  const bot = getBot();
  await ensureInit(bot);

  const { data: hs } = await admin
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();
  if (!hs) return NextResponse.json({ ok: true, erinnert: 0 });

  const { data: cfgRows } = await admin
    .from("regel_config")
    .select("mannschaft_id, config")
    .eq("halbserie_id", hs.id);
  const cfgVon = new Map<string, { std: number; max: number }>();
  for (const r of cfgRows ?? []) {
    cfgVon.set((r as any).mannschaft_id, {
      std: Number((r as any).config?.reminder_nach_stunden ?? 48),
      max: Number((r as any).config?.max_reminder ?? 2),
    });
  }

  const heute = heuteBerlin();
  const { data: offen } = await admin
    .from("verfuegbarkeiten")
    .select(
      "id, spieler_id, spiel_id, status, erinnert_count, updated_at, " +
        "spiele:spiel_id(datum, mannschaft_id, halbserie_id), spieler:spieler_id(telegram_chat_id)"
    )
    .in("status", ["angefragt", "erinnert"]);

  let erinnert = 0;
  let eskaliert = 0;

  for (const v of offen ?? []) {
    const spiel = (v as any).spiele;
    const chat = (v as any).spieler?.telegram_chat_id;
    if (!spiel || spiel.halbserie_id !== hs.id) continue;
    if (spiel.datum < heute) continue; // Spiel vorbei
    if (!chat) continue; // nur gekoppelte Spieler erinnern

    const cfg = cfgVon.get(spiel.mannschaft_id) ?? { std: 48, max: 2 };
    const elapsedH =
      (Date.now() - Date.parse((v as any).updated_at)) / 3_600_000;
    if (elapsedH < cfg.std) continue; // noch nicht fällig

    const count = Number((v as any).erinnert_count ?? 0);

    if (count < cfg.max) {
      const info = await ladeSpiel(admin, (v as any).spiel_id);
      if (!info) continue;
      try {
        const msg = await bot.api.sendMessage(
          Number(chat),
          "⏰ Kleine Erinnerung:\n\n" + abfrageText(info),
          { parse_mode: "Markdown", reply_markup: abfrageKeyboard(info.id) }
        );
        await admin
          .from("verfuegbarkeiten")
          .update({ status: "erinnert", erinnert_count: count + 1 })
          .eq("id", (v as any).id);
        await admin.from("nachrichten").insert({
          spieler_id: (v as any).spieler_id,
          spiel_id: info.id,
          richtung: "ausgehend",
          kanal: "telegram",
          typ: "reminder",
          inhalt: "Erinnerung an offene Abfrage",
          telegram_message_id: msg.message_id,
        });
        erinnert++;
      } catch {
        // Zustellfehler überspringen
      }
    } else {
      // Maximale Erinnerungen erreicht -> keine_antwort + Eskalationsvermerk
      await admin
        .from("verfuegbarkeiten")
        .update({ status: "keine_antwort" })
        .eq("id", (v as any).id);
      await admin.from("audit_log").insert({
        benutzer_id: null,
        aktion: "eskalation",
        entitaet: "verfuegbarkeiten",
        entitaet_id: (v as any).id,
        details: {
          spiel_id: (v as any).spiel_id,
          spieler_id: (v as any).spieler_id,
          grund: "keine Antwort nach maximaler Erinnerung",
        },
      });
      eskaliert++;
    }
  }

  return NextResponse.json({ ok: true, erinnert, eskaliert });
}
