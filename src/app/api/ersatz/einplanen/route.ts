import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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
    .select("id, datum, mannschaft_id, halbserie_id")
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

  return NextResponse.json({ ok: true });
}
