-- =============================================================================
-- Import: Vorrunde 2026/27 · BC 1920 Efferen (Quelle: mytischtennis.de / click-TT)
--
-- Ersetzt für die aktive Halbserie die Spiele der 6 Mannschaften durch den
-- echten Spielplan und setzt die richtigen Liga-Bezeichnungen.
-- Idempotent: pro Mannschaft werden vorhandene Spiele der Halbserie zuerst
-- gelöscht, dann neu eingefügt. (Löschen entfernt auch die daran hängenden
-- Verfügbarkeiten — bei den Demo-Daten gewollt.)
--
-- Heim/Auswärts aus Sicht von BC Efferen. Zeiten und Termine wie in click-TT.
-- =============================================================================

do $$
declare
  v_hs uuid;
  v_t  uuid;
begin
  select id into v_hs from halbserien where aktiv limit 1;
  if v_hs is null then raise exception 'Keine aktive Halbserie gefunden.'; end if;

  -- ---- 1. Mannschaft · Bezirksoberliga 1 ----------------------------------
  select id into v_t from mannschaften where nummer = 1;
  update mannschaften set liga = 'Bezirksoberliga 1' where id = v_t;
  delete from spiele where halbserie_id = v_hs and mannschaft_id = v_t;
  insert into spiele (halbserie_id, mannschaft_id, spieltag_nr, datum, uhrzeit, heim, gegner, status) values
    (v_hs, v_t, 1,  '2026-09-04', '20:00', true,  'TTC BR Geyen', 'geplant'),
    (v_hs, v_t, 2,  '2026-09-11', '20:00', false, '1. FC Köln V', 'geplant'),
    (v_hs, v_t, 3,  '2026-09-18', '20:00', true,  'SC SW Friesheim', 'geplant'),
    (v_hs, v_t, 4,  '2026-10-03', '18:00', false, 'TTC BW Lechenich', 'geplant'),
    (v_hs, v_t, 5,  '2026-10-09', '20:00', true,  'TTC Mödrath III', 'geplant'),
    (v_hs, v_t, 6,  '2026-10-16', '20:00', true,  'TTC Lövenich', 'geplant'),
    (v_hs, v_t, 7,  '2026-11-08', '11:00', false, 'TTG Vogelsang', 'geplant'),
    (v_hs, v_t, 8,  '2026-11-13', '20:00', true,  'TTV DJK Hürth', 'geplant'),
    (v_hs, v_t, 9,  '2026-11-20', '19:30', false, '1. TTC Köln', 'geplant'),
    (v_hs, v_t, 10, '2026-11-27', '20:00', true,  'TTF GW Elsdorf', 'geplant'),
    (v_hs, v_t, 11, '2026-12-04', '20:00', false, 'BC Vikt. Glesch/Paffendorf', 'geplant');

  -- ---- 2. Mannschaft · 1. Bezirksliga 1 -----------------------------------
  select id into v_t from mannschaften where nummer = 2;
  update mannschaften set liga = '1. Bezirksliga 1' where id = v_t;
  delete from spiele where halbserie_id = v_hs and mannschaft_id = v_t;
  insert into spiele (halbserie_id, mannschaft_id, spieltag_nr, datum, uhrzeit, heim, gegner, status) values
    (v_hs, v_t, 1, '2026-09-06', '10:00', true,  'TTC Sindorf', 'geplant'),
    (v_hs, v_t, 2, '2026-09-20', '10:00', true,  '1. TTC Köln II', 'geplant'),
    (v_hs, v_t, 3, '2026-09-29', '19:45', false, 'TTG Berzdorf', 'geplant'),
    (v_hs, v_t, 4, '2026-10-11', '10:00', true,  'FC Junkersdorf II', 'geplant'),
    (v_hs, v_t, 5, '2026-11-07', '18:30', false, '1. FC Köln VI', 'geplant'),
    (v_hs, v_t, 6, '2026-11-14', '18:30', true,  'TTV DJK Hürth II', 'geplant'),
    (v_hs, v_t, 7, '2026-11-21', '18:30', false, 'TTC Bachem', 'geplant'),
    (v_hs, v_t, 8, '2026-11-29', '10:00', true,  'TSV Kenten', 'geplant'),
    (v_hs, v_t, 9, '2026-12-04', '19:30', false, 'TTC GW Brauweiler II', 'geplant');

  -- ---- 3. Mannschaft · 2. Bezirksliga 1 -----------------------------------
  select id into v_t from mannschaften where nummer = 3;
  update mannschaften set liga = '2. Bezirksliga 1' where id = v_t;
  delete from spiele where halbserie_id = v_hs and mannschaft_id = v_t;
  insert into spiele (halbserie_id, mannschaft_id, spieltag_nr, datum, uhrzeit, heim, gegner, status) values
    (v_hs, v_t, 1, '2026-09-11', '20:00', true,  'TTC Bachem II', 'geplant'),
    (v_hs, v_t, 2, '2026-09-19', '18:30', false, 'TTG Langenich II', 'geplant'),
    (v_hs, v_t, 3, '2026-10-02', '20:00', true,  'BC Bliesheim', 'geplant'),
    (v_hs, v_t, 4, '2026-10-10', '18:30', false, '1. TTC Köln III', 'geplant'),
    (v_hs, v_t, 5, '2026-10-17', '18:30', false, 'TV Brühl', 'geplant'),
    (v_hs, v_t, 6, '2026-11-06', '20:00', true,  'TTC BR Geyen II', 'geplant'),
    (v_hs, v_t, 7, '2026-11-23', '19:45', false, 'TSV Immendorf', 'geplant'),
    (v_hs, v_t, 8, '2026-12-04', '20:00', true,  'TTC Pingsdorf/Badorf', 'geplant');

  -- ---- 4. Mannschaft · 2. Bezirksklasse 3 ---------------------------------
  select id into v_t from mannschaften where nummer = 4;
  update mannschaften set liga = '2. Bezirksklasse 3' where id = v_t;
  delete from spiele where halbserie_id = v_hs and mannschaft_id = v_t;
  insert into spiele (halbserie_id, mannschaft_id, spieltag_nr, datum, uhrzeit, heim, gegner, status) values
    (v_hs, v_t, 1, '2026-09-05', '18:30', true,  'TTC Lövenich IV', 'geplant'),
    (v_hs, v_t, 2, '2026-09-19', '18:30', true,  'TS Frechen II', 'geplant'),
    (v_hs, v_t, 3, '2026-10-02', '20:00', false, 'TSV Kenten II', 'geplant'),
    (v_hs, v_t, 4, '2026-10-10', '18:30', true,  'SV RW Zollstock', 'geplant'),
    (v_hs, v_t, 5, '2026-10-17', '18:30', true,  'SV Arminia Köln IV', 'geplant'),
    (v_hs, v_t, 6, '2026-11-06', '19:45', false, 'TTC Bachem V', 'geplant'),
    (v_hs, v_t, 7, '2026-11-14', '18:30', true,  'TTV DJK Hürth V', 'geplant'),
    (v_hs, v_t, 8, '2026-11-28', '18:30', true,  'TTC RW Esch II', 'geplant'),
    (v_hs, v_t, 9, '2026-12-04', '19:30', false, 'TTC GW Brauweiler III', 'geplant');

  -- ---- 5. Mannschaft · 3. Bezirksklasse 2 ---------------------------------
  select id into v_t from mannschaften where nummer = 5;
  update mannschaften set liga = '3. Bezirksklasse 2' where id = v_t;
  delete from spiele where halbserie_id = v_hs and mannschaft_id = v_t;
  insert into spiele (halbserie_id, mannschaft_id, spieltag_nr, datum, uhrzeit, heim, gegner, status) values
    (v_hs, v_t, 1, '2026-09-13', '10:00', true,  'TS Frechen IV', 'geplant'),
    (v_hs, v_t, 2, '2026-09-20', '12:00', false, 'TTC Bachem VI', 'geplant'),
    (v_hs, v_t, 3, '2026-09-24', '19:00', false, 'SV Arminia Köln V', 'geplant'),
    (v_hs, v_t, 4, '2026-10-04', '10:00', true,  'FC Junkersdorf V', 'geplant'),
    (v_hs, v_t, 5, '2026-10-05', '19:45', false, 'TSV Immendorf IV', 'geplant'),
    (v_hs, v_t, 6, '2026-10-18', '10:00', false, 'TTC Pingsdorf/Badorf IV', 'geplant'),
    (v_hs, v_t, 7, '2026-11-10', '19:30', false, '1. FC Quadrath-Ichendorf II', 'geplant'),
    (v_hs, v_t, 8, '2026-11-27', '19:30', false, 'TTC BW Lechenich IV', 'geplant'),
    (v_hs, v_t, 9, '2026-12-06', '10:00', true,  'TSV Kenten V', 'geplant');

  -- ---- 6. Mannschaft · 3. Bezirksklasse 4 ---------------------------------
  select id into v_t from mannschaften where nummer = 6;
  update mannschaften set liga = '3. Bezirksklasse 4' where id = v_t;
  delete from spiele where halbserie_id = v_hs and mannschaft_id = v_t;
  insert into spiele (halbserie_id, mannschaft_id, spieltag_nr, datum, uhrzeit, heim, gegner, status) values
    (v_hs, v_t, 1, '2026-09-04', '19:00', false, 'TPS Köln III', 'geplant'),
    (v_hs, v_t, 2, '2026-09-11', '20:00', true,  'ESV Olympia Köln II', 'geplant'),
    (v_hs, v_t, 3, '2026-09-19', '18:30', false, 'Pulheimer SC V', 'geplant'),
    (v_hs, v_t, 4, '2026-10-03', '18:30', false, 'SV RW Zollstock II', 'geplant'),
    (v_hs, v_t, 5, '2026-10-09', '20:00', true,  'DJK spinfactory Köln VIII', 'geplant'),
    (v_hs, v_t, 6, '2026-10-17', '18:30', false, 'TFG Nippes VIII', 'geplant'),
    (v_hs, v_t, 7, '2026-11-20', '20:00', true,  'DJK Bocklemünd IV', 'geplant'),
    (v_hs, v_t, 8, '2026-11-28', '18:30', false, 'Roter Stern Köln', 'geplant');

  raise notice 'Vorrunde 2026/27 importiert.';
end $$;
