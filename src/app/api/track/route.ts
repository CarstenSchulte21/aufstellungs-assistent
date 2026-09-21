import { getSession } from "@/lib/auth";
import { getAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Normalisiert den Pfad, damit die Statistik sinnvoll aggregiert und keine
// konkreten IDs (welches Spiel jemand ansah) gespeichert werden.
function normalisiere(pfad: string): string {
  let p = (pfad || "").split("?")[0].split("#")[0];
  if (!p.startsWith("/")) return "/";
  // UUIDs -> [id]
  p = p.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    "[id]"
  );
  // reine Zahl-Segmente -> [id]
  p = p.replace(/\/\d+(?=\/|$)/g, "/[id]");
  if (p.length > 120) p = p.slice(0, 120);
  return p;
}

// Zeichnet einen anonymen Seitenaufruf auf (nur eingeloggte Nutzung, ohne
// Personenbezug — nur Pfad + Rolle).
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  // Ohne Session (z. B. Login-Seite) wird nichts protokolliert.
  if (!session) return new Response(null, { status: 204 });

  const body = await req.json().catch(() => ({}));
  const pfad = normalisiere(String(body?.pfad ?? ""));
  const rolle = session.modus; // admin | mf | spieler (aggregiert)

  try {
    const admin = getAdmin();
    // anonymer Seitenaufruf (kein Personenbezug)
    await admin.from("seitenaufrufe").insert({ pfad, rolle });
    // „zuletzt aktiv" des Kontos aktualisieren (misst echte Nutzung, nicht nur
    // Neuanmeldungen) — separater, personenbezogener Zeitstempel.
    await admin
      .from("benutzer")
      .update({ letzte_aktivitaet_am: new Date().toISOString() })
      .eq("id", session.userId);
  } catch {
    // Statistik ist optional — Fehler nie an den Nutzer durchreichen.
  }
  return new Response(null, { status: 204 });
}
