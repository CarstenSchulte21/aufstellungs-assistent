import type { SupabaseClient } from "@supabase/supabase-js";

// Adoptions-/Anmelde-Statistik aus vorhandenen Daten — kein zusätzliches
// Tracking. Zeigt, wer erreichbar ist und wer sich (lange nicht) angemeldet hat.

export type StilleSpieler = {
  name: string;
  letzteAktivitaet: string | null; // ISO oder null = nie aktiv
};

export type Adoption = {
  spielerGesamt: number;
  mitKonto: number;
  ohneKonto: number;
  mitTelegram: number;
  mitEmail: number;
  ohneKanal: number;
  aktiv30: number; // Konten, die in den letzten 30 Tagen aktiv waren
  nieAktiv: number; // verknüpfte Konten ohne jede Aktivität
  laenger30: number; // verknüpft, aber >30 Tage keine Aktivität
  stille: StilleSpieler[]; // verknüpft + nie/lange nicht aktiv
};

export async function ladeAdoption(admin: SupabaseClient): Promise<Adoption> {
  const { data: spieler } = await admin
    .from("spieler")
    .select("id, name, email, telegram_chat_id, kanal");
  const alle = (spieler ?? []) as any[];

  const { data: benutzer } = await admin
    .from("benutzer")
    .select("id, spieler_id, letzte_aktivitaet_am");
  // spieler_id -> { benutzer_id, aktivAm }
  const kontoVonSpieler = new Map<
    string,
    { id: string; aktivAm: string | null }
  >();
  for (const b of (benutzer ?? []) as any[])
    if (b.spieler_id)
      kontoVonSpieler.set(b.spieler_id, {
        id: b.id,
        aktivAm: b.letzte_aktivitaet_am ?? null,
      });

  // Letzte Anmeldung je Konto (nur Rückfall, falls noch keine Aktivität erfasst)
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 200 });
  const anmeldungVon = new Map<string, string | null>();
  for (const u of (userList?.users ?? []) as any[])
    anmeldungVon.set(u.id, u.last_sign_in_at ?? null);

  const grenze30 = Date.now() - 30 * 24 * 3600 * 1000;

  let mitKonto = 0;
  let mitTelegram = 0;
  let mitEmail = 0;
  let ohneKanal = 0;
  let aktiv30 = 0;
  let nieAktiv = 0;
  let laenger30 = 0;
  const stille: StilleSpieler[] = [];

  for (const s of alle) {
    const hatTelegram = Boolean(s.telegram_chat_id);
    const hatMail = Boolean(s.email && String(s.email).trim());
    if (hatTelegram) mitTelegram++;
    if (hatMail) mitEmail++;
    if (!hatTelegram && !hatMail) ohneKanal++;

    const konto = kontoVonSpieler.get(s.id);
    if (!konto) continue; // kein verknüpftes Konto
    mitKonto++;

    // Echte Aktivität bevorzugen, ersatzweise die letzte Anmeldung
    const letzte = konto.aktivAm ?? anmeldungVon.get(konto.id) ?? null;
    if (!letzte) {
      nieAktiv++;
      stille.push({ name: s.name, letzteAktivitaet: null });
    } else if (Date.parse(letzte) >= grenze30) {
      aktiv30++;
    } else {
      laenger30++;
      stille.push({ name: s.name, letzteAktivitaet: letzte });
    }
  }

  // Stille zuletzt: nie aktiv zuerst, dann nach ältester Aktivität
  stille.sort((a, b) => {
    if (!a.letzteAktivitaet && b.letzteAktivitaet) return -1;
    if (a.letzteAktivitaet && !b.letzteAktivitaet) return 1;
    return (a.letzteAktivitaet ?? "").localeCompare(b.letzteAktivitaet ?? "");
  });

  return {
    spielerGesamt: alle.length,
    mitKonto,
    ohneKonto: alle.length - mitKonto,
    mitTelegram,
    mitEmail,
    ohneKanal,
    aktiv30,
    nieAktiv,
    laenger30,
    stille,
  };
}
