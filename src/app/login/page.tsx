"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [modus, setModus] = useState<"anmelden" | "registrieren" | "vergessen">(
    "anmelden"
  );
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");
  const [gesendet, setGesendet] = useState(false);

  async function resetSenden(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFehler("");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/konto`,
    });
    setBusy(false);
    if (error) setFehler("Konnte nicht gesendet werden: " + error.message);
    else setGesendet(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFehler("");
    const supabase = createClient();

    if (modus === "registrieren") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pw,
      });
      if (error) {
        setBusy(false);
        setFehler(
          /already registered|exists/i.test(error.message)
            ? "Für diese E-Mail gibt es schon ein Konto. Bitte melde dich an."
            : /at least/i.test(error.message)
            ? "Das Passwort muss mindestens 6 Zeichen haben."
            : "Registrierung fehlgeschlagen: " + error.message
        );
        return;
      }
      if (!data.session) {
        setBusy(false);
        setFehler(
          "Konto angelegt, aber es fehlt noch die Freigabe. Bitte melde dich beim Admin."
        );
        return;
      }
      window.location.assign("/");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });
    if (error) {
      setBusy(false);
      setFehler("E-Mail oder Passwort ist falsch.");
      return;
    }
    window.location.assign("/");
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
            <p className="text-[12px] text-slate-500">
              {modus === "anmelden"
                ? "Anmeldung"
                : modus === "registrieren"
                ? "Konto anlegen"
                : "Passwort zurücksetzen"}
            </p>
          </div>
        </div>

        {modus === "vergessen" ? (
          <div className="space-y-3">
            {gesendet ? (
              <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-semibold">E-Mail ist unterwegs.</p>
                <p className="mt-1">
                  Öffne den Link in der Mail — am besten in diesem Browser.
                  Danach kannst du direkt ein neues Passwort setzen.
                </p>
              </div>
            ) : (
              <form onSubmit={resetSenden} className="space-y-3">
                <p className="text-[13px] text-slate-600">
                  Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit
                  dem du ein neues Passwort setzen kannst.
                </p>
                <label className="block text-sm font-medium text-slate-700">
                  E-Mail-Adresse
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
                >
                  {busy ? "Wird gesendet…" : "Link senden"}
                </button>
                {fehler && <p className="text-sm text-rose-600">{fehler}</p>}
              </form>
            )}
            <button
              type="button"
              onClick={() => {
                setModus("anmelden");
                setFehler("");
                setGesendet(false);
              }}
              className="text-[12px] text-slate-500 hover:underline"
            >
              ← Zurück zur Anmeldung
            </button>
            <p className="text-[12px] text-slate-400">
              Keine Mail bekommen? Melde dich beim Admin — er kann dir direkt ein
              neues Passwort setzen.
            </p>
          </div>
        ) : (
        <>
        <div className="mb-4 flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => {
              setModus("anmelden");
              setFehler("");
            }}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              modus === "anmelden"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            Anmelden
          </button>
          <button
            type="button"
            onClick={() => {
              setModus("registrieren");
              setFehler("");
            }}
            className={`flex-1 rounded-md px-3 py-1.5 transition ${
              modus === "registrieren"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500"
            }`}
          >
            Erstes Mal
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            E-Mail-Adresse
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@verein.de"
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Passwort
            <input
              type="password"
              required
              minLength={6}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={modus === "registrieren" ? "mind. 6 Zeichen" : "••••••••"}
              autoComplete={
                modus === "registrieren" ? "new-password" : "current-password"
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
          >
            {busy
              ? "Bitte warten…"
              : modus === "registrieren"
              ? "Konto anlegen & anmelden"
              : "Anmelden"}
          </button>
          {fehler && <p className="text-sm text-rose-600">{fehler}</p>}
        </form>

        {modus === "anmelden" && (
          <button
            type="button"
            onClick={() => {
              setModus("vergessen");
              setFehler("");
              setGesendet(false);
            }}
            className="pt-3 text-[12px] font-medium text-primary hover:underline"
          >
            Passwort vergessen?
          </button>
        )}

        <p className="pt-3 text-[12px] text-slate-400">
          {modus === "registrieren"
            ? "Nutze die E-Mail-Adresse, die dein Mannschaftsführer hinterlegt hat — nur dann wirst du deinem Spielerprofil zugeordnet."
            : "Zum ersten Mal hier? Wechsle oben auf den Reiter für neue Konten und lege dir ein Passwort an."}
        </p>
        </>
        )}
      </div>
    </main>
  );
}
