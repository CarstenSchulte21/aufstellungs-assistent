"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PasswortForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [fehler, setFehler] = useState("");

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setFehler("");
    if (pw.length < 6) {
      setFehler("Das Passwort muss mindestens 6 Zeichen haben.");
      return;
    }
    if (pw !== pw2) {
      setFehler("Die beiden Passwörter stimmen nicht überein.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setFehler("Konnte nicht gespeichert werden: " + error.message);
      return;
    }
    setPw("");
    setPw2("");
    setMsg("Passwort gespeichert ✓ Du kannst dich damit ab sofort überall anmelden.");
  }

  return (
    <form onSubmit={speichern} className="max-w-sm space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        Neues Passwort
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          minLength={6}
          autoComplete="new-password"
          placeholder="mind. 6 Zeichen"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Passwort wiederholen
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
      >
        {busy ? "Speichern…" : "Passwort speichern"}
      </button>
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      {fehler && <p className="text-sm text-rose-600">{fehler}</p>}
    </form>
  );
}
