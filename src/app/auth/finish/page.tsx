"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Schließt die Anmeldung ab: liest die Tokens aus dem URL-Fragment (Implicit-
// Flow) und setzt die Session. Funktioniert in jedem Browser/Gerät, weil kein
// browsergebundener PKCE-Verifier nötig ist.
export default function AuthFinish() {
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = window.location.hash.replace(/^#/, "");
      const p = new URLSearchParams(raw);
      const access_token = p.get("access_token");
      const refresh_token = p.get("refresh_token");
      if (p.get("error_description") || !access_token || !refresh_token) {
        setFehler(true);
        setTimeout(() => window.location.assign("/login?error=auth"), 2000);
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      window.location.assign(error ? "/login?error=auth" : "/");
    })();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        {fehler
          ? "Anmeldung fehlgeschlagen. Du wirst zur Anmeldung zurückgeleitet…"
          : "Anmeldung wird abgeschlossen…"}
      </div>
    </main>
  );
}
