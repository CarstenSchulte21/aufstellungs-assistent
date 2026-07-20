import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { loadMatrix } from "@/lib/matrix";

export const dynamic = "force-dynamic";

// Liefert nur die Matrix einer Mannschaft (für schnelles Blättern ohne
// kompletten Seiten-Neuaufbau). RLS greift über den Session-Client.
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const team = searchParams.get("team");
  if (!team)
    return NextResponse.json({ error: "team fehlt" }, { status: 400 });

  const supabase = createClient();
  const matrix = await loadMatrix(supabase, team);
  return NextResponse.json({ matrix });
}
