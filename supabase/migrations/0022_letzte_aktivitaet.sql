-- =============================================================================
-- Aufstellungs-Assistent · Migration 0022 — Letzte Aktivität je Konto
--
-- Für die Adoptions-Statistik: Supabase führt zwar last_sign_in_at, das
-- aktualisiert sich aber nur bei einer echten Neuanmeldung. Wer eine dauerhafte
-- Sitzung hat, gilt sonst fälschlich als „still". Dieser Zeitstempel wird bei
-- jeder Nutzung (über /api/track) aktualisiert und misst tatsächliche Aktivität.
-- =============================================================================

alter table benutzer
  add column if not exists letzte_aktivitaet_am timestamptz;
