-- =============================================================================
-- Aufstellungs-Assistent · Migration 0019 — Marker „Verlegung in Klärung"
--
-- Ein Spieltag kann wochenlang „in der Schwebe" sein, während MF und Gegner
-- über eine Verlegung verhandeln. Dieser Marker macht das sichtbar (Übersicht
-- und Spieltag-Detail), ohne den Status anzutasten: Der Termin gilt weiter,
-- die Verfügbarkeits-Abfrage läuft normal — er könnte ja doch bleiben.
--
-- Bewusst ein eigenes Feld statt des Enum-Werts 'verlegung_angefragt', damit
-- Abfrage/Reminder (die auf status = 'geplant' bauen) unberührt bleiben.
-- =============================================================================

alter table spiele
  add column if not exists verlegung_in_klaerung boolean not null default false;

comment on column spiele.verlegung_in_klaerung is
  'MF-Marker: Verlegung wird gerade verhandelt, Termin noch offen';
