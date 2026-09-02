import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { baueICS } from "@/lib/ical";
import { ladeTeamKalender, ladeSpielerKalender } from "@/lib/kalenderdaten";

export const dynamic = "force-dynamic";

// Liefert einen Kalender als .ics-Download.
//   ?team=<id>  -> alle Spieltage dieser Mannschaft
//   (ohne team) -> persönlicher Kalender des angemeldeten Spielers
// RLS greift über den Session-Client.
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session)
    return new Response("Nicht angemeldet", { status: 401 });

  const { searchParams } = new URL(request.url);
  const team = searchParams.get("team");

  const supabase = createClient();
  const daten = team
    ? await ladeTeamKalender(supabase, team)
    : session.spielerId
    ? await ladeSpielerKalender(supabase, session.spielerId)
    : null;

  if (!daten)
    return new Response("Kein Kalender verfügbar", { status: 404 });

  const ics = baueICS(daten.events, daten.name);
  const dateiname =
    (team ? daten.name : "meine-spiele")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + ".ics";

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dateiname}"`,
      "Cache-Control": "no-store",
    },
  });
}
