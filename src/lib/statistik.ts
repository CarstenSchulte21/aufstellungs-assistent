import type { SupabaseClient } from "@supabase/supabase-js";

// Adoptions-/Anmelde-Statistik aus vorhandenen Daten — kein zusätzliches
// Tracking. Zeigt, wer erreichbar ist und wer sich (lange nicht) angemeldet hat.

export type StilleSpieler = {
  name: string;
  letzteAnmeldung: string | null; // ISO oder null = nie
};

export type Adoption = {
  spielerGesamt: number;
  mitKonto: number;
  ohneKonto: number;
  mitTelegram: number;
  mitEmail: number;
  ohneKanal: number;
  angemeldet30: number; // Konten mit Anmeldung in den letzten 30 Tagen
  nieAngemeldet: number; // verknüpfte Konten, die sich nie angemeldet haben
  laenger30: number; // verknüpft, aber >30 Tage keine Anmeldung
  stille: StilleSpieler[]; // verknüpft + nie/lange nicht angemeldet
};

export async function ladeAdoption(admin: SupabaseClient): Promise<Adoption> {
  const { data: spieler } = await admin
    .from("spieler")
    .select("id, name, email, telegram_chat_id, kanal");
  const alle = (spieler ?? []) as any[];

  const { data: benutzer } = await admin
    .from("benutzer")
    .select("id, spieler_id");
  const kontoVonSpieler = new Map<string, string>(); // spieler_id -> benutzer_id
  for (const b of (benutzer ?? []) as any[])
    if (b.spieler_id) kontoVonSpieler.set(b.spieler_id, b.id);

  // Letzte Anmeldung je Konto aus dem Auth-System
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 200 });
  const letzteVon = new Map<string, string | null>();
  for (const u of (userList?.users ?? []) as any[])
    letzteVon.set(u.id, u.last_sign_in_at ?? null);

  const jetzt = Date.now();
  const grenze30 = jetzt - 30 * 24 * 3600 * 1000;

  let mitKonto = 0;
  let mitTelegram = 0;
  let mitEmail = 0;
  let ohneKanal = 0;
  let angemeldet30 = 0;
  let nieAngemeldet = 0;
  let laenger30 = 0;
  const stille: StilleSpieler[] = [];

  for (const s of alle) {
    const hatTelegram = Boolean(s.telegram_chat_id);
    const hatMail = Boolean(s.email && String(s.email).trim());
    if (hatTelegram) mitTelegram++;
    if (hatMail) mitEmail++;
    if (!hatTelegram && !hatMail) ohneKanal++;

    const kontoId = kontoVonSpieler.get(s.id);
    if (!kontoId) continue; // kein verknüpftes Konto
    mitKonto++;

    const letzte = letzteVon.get(kontoId) ?? null;
    if (!letzte) {
      nieAngemeldet++;
      stille.push({ name: s.name, letzteAnmeldung: null });
    } else if (Date.parse(letzte) >= grenze30) {
      angemeldet30++;
    } else {
      laenger30++;
      stille.push({ name: s.name, letzteAnmeldung: letzte });
    }
  }

  // Stille zuletzt: nie angemeldet zuerst, dann nach ältester Anmeldung
  stille.sort((a, b) => {
    if (!a.letzteAnmeldung && b.letzteAnmeldung) return -1;
    if (a.letzteAnmeldung && !b.letzteAnmeldung) return 1;
    return (a.letzteAnmeldung ?? "").localeCompare(b.letzteAnmeldung ?? "");
  });

  return {
    spielerGesamt: alle.length,
    mitKonto,
    ohneKonto: alle.length - mitKonto,
    mitTelegram,
    mitEmail,
    ohneKanal,
    angemeldet30,
    nieAngemeldet,
    laenger30,
    stille,
  };
}
