import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Ein Spieler (oder sein Proxy/Admin) beantwortet eine Ersatzanfrage in der
// Webapp — analog zur Telegram-Antwort. Aktualisiert Anfrage + Verfügbarkeit.
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { ersatzanfrage_id, antwort } = await req.json().catch(() => ({}));
  if (!ersatzanfrage_id || !["ja", "nein"].includes(antwort))
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });

  const admin = getAdmin();
  const { data: anfrage } = await admin
    .from("ersatzanfragen")
    .select("id, spiel_id, spieler_id, status")
    .eq("id", ersatzanfrage_id)
    .maybeSingle();
  if (!anfrage) return NextResponse.json({ error: "Anfrage nicht gefunden" }, { status: 404 });

  // Berechtigung: eigener Spieler, Proxy oder Admin
  let erlaubt = session.isAdmin || session.spielerId === (anfrage as any).spieler_id;
  if (!erlaubt && session.spielerId) {
    const { data: ziel } = await admin
      .from("spieler")
      .select("proxy_spieler_id")
      .eq("id", (anfrage as any).spieler_id)
      .maybeSingle();
    erlaubt = ziel?.proxy_spieler_id === session.spielerId;
  }
  if (!erlaubt) return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });

  if (
    !["gesendet", "freigegeben", "zugesagt", "abgelehnt"].includes(
      (anfrage as any).status
    )
  )
    return NextResponse.json(
      { error: "Diese Anfrage ist nicht mehr änderbar." },
      { status: 409 }
    );

  const neu = antwort === "ja" ? "zugesagt" : "abgelehnt";
  await admin
    .from("ersatzanfragen")
    .update({ status: neu, beantwortet_am: new Date().toISOString() })
    .eq("id", ersatzanfrage_id);
  await admin.from("verfuegbarkeiten").upsert(
    {
      spiel_id: (anfrage as any).spiel_id,
      spieler_id: (anfrage as any).spieler_id,
      status: antwort === "ja" ? "zugesagt" : "abgesagt",
      quelle: "webapp",
    },
    { onConflict: "spiel_id,spieler_id" }
  );

  return NextResponse.json({ ok: true });
}
