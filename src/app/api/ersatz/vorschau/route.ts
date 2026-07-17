import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { ladeKandidaten } from "@/lib/engine/laden";

export const dynamic = "force-dynamic";

// Live-Vorschau der Ersatzkandidaten für einen Spieltag (nach gespeicherter
// Regelkonfiguration). Nur MF/Admin.
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session || (!session.isAdmin && !session.isMf))
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });

  const { spiel_id } = await req.json().catch(() => ({}));
  if (!spiel_id)
    return NextResponse.json({ error: "spiel_id fehlt" }, { status: 400 });

  const supabase = createClient();
  const res = await ladeKandidaten(supabase, spiel_id);
  return NextResponse.json({ kandidaten: res?.kandidaten ?? [] });
}
