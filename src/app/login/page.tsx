"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [fehler, setFehler] = useState("");

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setFehler("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setFehler(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg text-white">
            🏓
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-slate-900">
              Aufstellungs-Assistent
            </h1>
            <p className="text-[12px] text-slate-500">Anmeldung per E-Mail-Link</p>
          </div>
        </div>

        {status === "sent" ? (
          <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">E-Mail ist unterwegs.</p>
            <p className="mt-1">
              Wir haben dir einen Anmelde-Link an <strong>{email}</strong>{" "}
              geschickt. Öffne ihn auf diesem Gerät, dann bist du drin.
            </p>
          </div>
        ) : (
          <form onSubmit={login} className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              E-Mail-Adresse
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@verein.de"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
            >
              {status === "sending" ? "Link wird gesendet…" : "Anmelde-Link senden"}
            </button>
            {status === "error" && (
              <p className="text-sm text-rose-600">
                Fehler: {fehler || "Bitte später erneut versuchen."}
              </p>
            )}
            <p className="pt-1 text-[12px] text-slate-400">
              Noch nicht angelegt? Dein Mannschaftsführer muss dich zuerst
              hinzufügen.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
