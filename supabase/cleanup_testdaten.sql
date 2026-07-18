-- =============================================================================
-- Aufstellungs-Assistent · Testdaten aufräumen (vor dem Test mit echten MF)
--
-- Entfernt NUR Abfragen/Zusagen und das Drumherum. Kader (kader_zuordnung),
-- Meldungen, Mannschaften, Spielplan (spiele), Regelkonfiguration, Spieler-
-- Stammdaten und Telegram-Kopplungen bleiben unangetastet.
--
-- Ausführen im Supabase SQL-Editor (dort gilt kein RLS). Läuft in einer
-- Transaktion — bei einem Fehler wird nichts geändert.
-- =============================================================================

begin;

-- ── Block 1: Zusagen & Anfragen (das eigentliche Anliegen) ──────────────────
delete from verfuegbarkeiten;   -- alle Zu-/Absagen/„angefragt" in der Matrix
delete from ersatzanfragen;     -- alle Ersatzanfragen (offen/erledigt)

-- ── Block 2: Aufräumen drumherum (empfohlen) ────────────────────────────────
delete from nachrichten;        -- protokollierte Telegram-Nachrichten (Test)
delete from einsaetze;          -- Einsatz-/Fairness-Zähler (Test)

-- ── Block 3: OPTIONAL — nur bei Bedarf die Kommentarzeichen entfernen ───────
-- Test-Abwesenheiten löschen (Achtung: auch echte, z. B. dein eigener Urlaub):
-- delete from abwesenheiten;
--
-- Test-Verlegungen/Absetzungen am Spielplan zurücksetzen (Datum bleibt!):
-- update spiele set status = 'geplant', verlegt_von = null
--   where status in ('verlegt', 'abgesetzt', 'verlegung_angefragt')
--      or verlegt_von is not null;
--
-- Änderungs-Protokoll leeren:
-- delete from audit_log;

commit;

-- Kontrolle: sollte jeweils 0 zeigen
select
  (select count(*) from verfuegbarkeiten) as verfuegbarkeiten,
  (select count(*) from ersatzanfragen)   as ersatzanfragen,
  (select count(*) from nachrichten)      as nachrichten,
  (select count(*) from einsaetze)        as einsaetze;
