import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/supabase/admin";
import { getBot, ensureInit } from "@/lib/telegram/bot";
import {
  ladeSpiel,
  gekoppelteSpieler,
  sendeAbfrageAnSpieler,
} from "@/lib/telegram/abfrage";
import { cronErlaubt, heuteBerlin, plusTage } from "@/lib/cron";

export const dynamic = "force-dynamic";

// SPEC A.7 „Erstabfrage": Spiele finden, deren Termin innerhalb des Vorlaufs
// liegt, und noch nicht angefragte, gekoppelte, aktive Spieler anschreiben.
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
  if (!hs) return NextResponse.json({ ok: true, gesendet: 0, hinweis: "keine aktive Halbserie" });

  // Regelkonfiguration je Mannschaft (Vorlauf)
  const { data: cfgRows } = await admin
    .from("regel_config")
    .select("mannschaft_id, config")
    .eq("halbserie_id", hs.id);
  const vorlaufVon = new Map<string, number>();
  for (const r of cfgRows ?? []) {
    vorlaufVon.set(
      (r as any).mannschaft_id,
      Number((r as any).config?.vorlauf_erstabfrage_tage ?? 28)
    );
  }

  const heute = heuteBerlin();
  const { data: spiele } = await admin
    .from("spiele")
    .select("id, mannschaft_id, datum")
    .eq("halbserie_id", hs.id)
    .eq("status", "geplant")
    .gte("datum", heute);

  let gesendet = 0;
  for (const spiel of spiele ?? []) {
    const vorlauf = vorlaufVon.get((spiel as any).mannschaft_id) ?? 28;
    if ((spiel as any).datum > plusTage(heute, vorlauf)) continue; // noch zu früh

    const info = await ladeSpiel(admin, (spiel as any).id);
    if (!info) continue;
    const empfaenger = await gekoppelteSpieler(admin, info);
    if (empfaenger.length === 0) continue;

    // Nur Spieler ohne bisherige Abfrage/Antwort anschreiben
    const { data: verf } = await admin
      .from("verfuegbarkeiten")
      .select("spieler_id, status")
      .eq("spiel_id", info.id);
    const schonAngefragt = new Set(
      (verf ?? [])
        .filter((v: any) => v.status && v.status !== "nicht_angefragt")
        .map((v: any) => v.spieler_id)
    );

    for (const e of empfaenger) {
      if (schonAngefragt.has(e.spieler_id)) continue;
      const res = await sendeAbfrageAnSpieler(admin, bot, info.id, e.spieler_id);
      if (res.ok) gesendet++;
    }
  }

  return NextResponse.json({ ok: true, gesendet });
}
