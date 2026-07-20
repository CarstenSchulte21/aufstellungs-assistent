-- =============================================================================
-- Aufstellungs-Assistent · Migration 0016 — Änderungsstempel am Spiel
--
-- Damit Spieler in ihrer Übersicht sehen, was sich zuletzt geändert hat
-- (verlegt, neue Uhrzeit, Heimrecht/Ort, abgesetzt), merkt sich das Spiel den
-- Zeitpunkt und die Art der letzten Änderung. Ohne das müssten wir das
-- Audit-Log durchsuchen.
-- =============================================================================

alter table spiele
  add column if not exists zuletzt_geaendert_am  timestamptz,
  add column if not exists zuletzt_geaendert_art text;

comment on column spiele.zuletzt_geaendert_art is
  'verlegt | uhrzeit | heimrecht | abgesetzt';
