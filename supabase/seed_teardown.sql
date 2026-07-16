-- =============================================================================
-- Demo-Daten entfernen (Mannschaften bleiben erhalten).
-- Reihenfolge: erst Einsätze der Demo-Spieler, dann die Demo-Halbserie
-- (kaskadiert Meldungen, Kader-Status, Spiele, Verfügbarkeiten, Regelkonfig,
-- Einsätze am Spiel), dann die Demo-Spieler selbst.
-- =============================================================================
delete from einsaetze
  where spieler_id in (select id from spieler where praeferenzen->>'_demo' = 'true');
delete from halbserien where bezeichnung like '%(DEMO)%';
delete from spieler where praeferenzen->>'_demo' = 'true';
