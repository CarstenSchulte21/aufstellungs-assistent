// Prüft, ob eine Cron-Anfrage berechtigt ist. Vercel Cron sendet automatisch
// den Header "Authorization: Bearer <CRON_SECRET>", wenn CRON_SECRET gesetzt
// ist. Zusätzlich erlauben wir manuelles Auslösen mit ?secret=... zum Testen.
export function cronErlaubt(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;
  return false;
}

// "Heute" in Europe/Berlin als YYYY-MM-DD.
export function heuteBerlin(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export function plusTage(iso: string, tage: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}
