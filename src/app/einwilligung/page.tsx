import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ConsentForm from "./ConsentForm";

export const dynamic = "force-dynamic";

export default async function EinwilligungPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profil } = await supabase
    .from("benutzer")
    .select("spieler_id")
    .eq("id", user.id)
    .maybeSingle();

  // Ohne verknüpften Spieler gibt es keine Bot-Kommunikation -> keine Einwilligung nötig.
  if (!profil?.spieler_id) redirect("/");

  const { data: spieler } = await supabase
    .from("spieler")
    .select("name, dsgvo_einwilligung_am")
    .eq("id", profil.spieler_id)
    .maybeSingle();

  if (spieler?.dsgvo_einwilligung_am) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">
          Willkommen{spieler?.name ? `, ${spieler.name}` : ""}!
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Bevor es losgeht, brauchen wir einmal deine Einwilligung nach der DSGVO.
        </p>

        <div className="mt-4 space-y-3 rounded-lg bg-slate-50 p-4 text-[13px] text-slate-600">
          <p>
            <strong>Zweck:</strong> Der Aufstellungs-Assistent fragt deine
            Verfügbarkeit für Spieltage ab (per Telegram oder in dieser Webapp)
            und hilft den Mannschaftsführern bei der Planung.
          </p>
          <p>
            <strong>Daten:</strong> Name, Kontaktdaten, deine Zu-/Absagen und
            Abwesenheiten. Sichtbar für den Verein sind deine Status in der
            Matrix; Freitext-Kommentare sehen nur du, dein Mannschaftsführer und
            der Admin.
          </p>
          <p>
            <strong>Widerruf:</strong> Du kannst deine Einwilligung jederzeit
            gegenüber deinem Mannschaftsführer widerrufen. Ohne Einwilligung
            bekommst du keine Bot-Nachrichten; die Webapp kannst du im Lesemodus
            weiter nutzen.
          </p>
        </div>

        <ConsentForm />
      </div>
    </main>
  );
}
