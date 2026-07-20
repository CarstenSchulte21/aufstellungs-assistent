import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Der Besitzer setzt einem Nutzer direkt ein neues Passwort — ohne E-Mail.
// Zuverlässiger Weg, wenn jemand ausgesperrt ist (Mailversand kann klemmen).
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!session.isOwner)
    return NextResponse.json(
      { error: "Nur der Besitzer darf Passwörter setzen" },
      { status: 403 }
    );

  const { user_id, passwort } = await req.json().catch(() => ({}));
  if (!user_id || typeof passwort !== "string" || passwort.length < 6)
    return NextResponse.json(
      { error: "Nutzer fehlt oder Passwort zu kurz (mind. 6 Zeichen)" },
      { status: 400 }
    );

  const admin = getAdmin();
  const { error } = await admin.auth.admin.updateUserById(user_id, {
    password: passwort,
  });
  if (error)
    return NextResponse.json(
      { error: "Konnte nicht gesetzt werden: " + error.message },
      { status: 500 }
    );

  await admin.from("audit_log").insert({
    aktion: "passwort_gesetzt",
    entitaet: "benutzer",
    entitaet_id: user_id,
    details: { durch: session.userId },
  });

  return NextResponse.json({ ok: true });
}
