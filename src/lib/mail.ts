// E-Mail-Versand über Brevo. Wird für Benachrichtigungen genutzt, wenn ein
// Spieler den Kanal "email" hat (bzw. nicht mit Telegram gekoppelt ist).
//
// Nötige Umgebungsvariablen (nur auf dem Server, niemals im Code):
//   BREVO_API_KEY          – API-Schlüssel aus dem Brevo-Konto
//   MAIL_ABSENDER_ADRESSE  – verifizierte Absenderadresse
//   MAIL_ABSENDER_NAME     – Anzeigename (optional)
//   APP_URL                – öffentliche Adresse der Web-App (für Links in Mails)

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export function appUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  ).replace(/\/$/, "");
}

export function mailAktiv(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.MAIL_ABSENDER_ADRESSE);
}

export async function sendeMail(opts: {
  an: string;
  name?: string | null;
  betreff: string;
  html: string;
}): Promise<boolean> {
  if (!mailAktiv()) return false;
  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY as string,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: process.env.MAIL_ABSENDER_ADRESSE,
          name: process.env.MAIL_ABSENDER_NAME || "Aufstellungs-Assistent",
        },
        to: [{ email: opts.an, ...(opts.name ? { name: opts.name } : {}) }],
        subject: opts.betreff,
        htmlContent: opts.html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Bausteine für ein schlichtes, gut lesbares Mail-Layout ──────────────────

export function mailLayout(inhalt: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
    <div style="font-weight:bold;font-size:16px;color:#123c73;margin-bottom:16px">🏓 Aufstellungs-Assistent</div>
    ${inhalt}
    <div style="margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:12px;color:#64748b;line-height:1.5">
      Du bekommst diese Nachricht, weil du im Kader deiner Mannschaft stehst —
      sie gehört zur Spieltagsplanung deines Vereins.<br />
      Keine E-Mails mehr? Stell es in der App unter „Spieltagsplanung → Meine
      Präferenzen“ um oder sag deinem Mannschaftsführer Bescheid.
    </div>
  </div></body></html>`;
}

// Vorspann für die allererste E-Mail an einen Spieler, damit niemand
// überrascht wird.
export function mailErstkontakt(): string {
  return `<div style="margin:0 0 16px;padding:12px;border-radius:8px;background:#eff6ff;font-size:14px;line-height:1.5;color:#1e3a5f">
    <strong>Neu:</strong> Ab sofort erreichen dich die Abfragen zur Spieltagsplanung per E-Mail.
    Antworten geht direkt hier mit einem Klick — du musst dich dafür nicht anmelden.
  </div>`;
}

export function mailButton(href: string, text: string, farbe: string): string {
  return `<a href="${href}" style="display:inline-block;margin:4px 6px 4px 0;padding:10px 16px;border-radius:8px;background:${farbe};color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px">${text}</a>`;
}

export function mailAbsatz(text: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${text}</p>`;
}

export const MAIL_GRUEN = "#059669";
export const MAIL_ROT = "#e11d48";
export const MAIL_GELB = "#d97706";
export const MAIL_BLAU = "#123c73";
