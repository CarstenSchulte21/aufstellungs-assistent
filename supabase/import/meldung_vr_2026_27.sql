-- =============================================================================
-- Import: Meldung Vorrunde 2026/27 · BC 1920 Efferen (Quelle: click-TT)
--
-- Ersetzt die Demo-Spieler durch die echten gemeldeten Spieler und legt für die
-- aktive Halbserie Meldung (Position, Sperrvermerk, RES) und Kader-Status an.
-- Status-Mapping: RES -> res=true, SBEM -> sperrvermerk=true.
--
-- ACHTUNG: Entfernt alle als Demo markierten Spieler (praeferenzen._demo=true)
-- inkl. deren bisheriger Verfügbarkeiten. Danach ist das System „echt".
-- Der Login von Carsten Schulte wird mit dem echten Spieler verknüpft.
--
-- Am besten NACH dem Spielplan-Import (vorrunde_2026_27.sql) ausführen.
-- =============================================================================

do $$
declare
  v_hs   uuid;
  v_team uuid;
  v_sp   uuid;
  rec    record;
begin
  select id into v_hs from halbserien where aktiv limit 1;
  if v_hs is null then raise exception 'Keine aktive Halbserie gefunden.'; end if;

  -- Halbserie in den Echtbetrieb umbenennen (Demo-Kennzeichnung entfernen)
  update halbserien set bezeichnung = 'Hinrunde 2026/27' where id = v_hs;

  -- Demo-Spieler entfernen (kaskadiert Meldung, Kader-Status, Verfügbarkeiten)
  delete from spieler where praeferenzen->>'_demo' = 'true';

  for rec in
    select * from (values
      (1, 1, 1895, false, false, 'Lars Bauer'),
      (1, 2, 1835, true,  false, 'Laura Matzke'),
      (1, 3, 1792, false, false, 'Kevin Zeiske'),
      (1, 4, 1677, false, false, 'Jörg Maaßen'),
      (1, 5, 1642, false, false, 'Eddie Bach'),
      (1, 6, 1594, false, false, 'Kushtrim Sadiku'),
      (1, 7, 1576, false, false, 'Ricardo Nelißen'),
      (2, 1, 1563, false, false, 'Philipp Scherer'),
      (2, 2, 1547, false, false, 'Norbert Gregert'),
      (2, 3, 1531, false, false, 'Danny Reinhardt'),
      (2, 4, 1502, false, false, 'Giacomo Janßen'),
      (3, 1, 1458, false, false, 'Jörg Spruth'),
      (3, 2, 1427, false, true,  'Noah Gregert'),
      (3, 3, 1448, false, false, 'Dieter van Loo'),
      (3, 4, 1422, false, false, 'Carsten Schulte'),
      (4, 1, 1391, false, false, 'Torben Binnberg'),
      (4, 2, 1350, false, false, 'Roman Clemenz'),
      (4, 3, 1338, false, false, 'Tim Herder'),
      (4, 4, 1321, false, false, 'Joachim Wanoth'),
      (5, 1, 1338, false, false, 'Marcus Sowada'),
      (5, 2, 1309, false, false, 'Manfred Husa'),
      (5, 3, 1247, true,  false, 'Stefan Olligschläger'),
      (5, 4, 1246, false, false, 'Ekkehard Landgräber'),
      (5, 5, 1234, false, false, 'Roland Rudloff'),
      (6, 1, 1266, true,  false, 'Tobias Amelong'),
      (6, 2, 1233, false, false, 'Jürgen Schlender'),
      (6, 3, 1221, false, false, 'Guido Scheufgen'),
      (6, 4, 1205, false, false, 'Tarak Dridi'),
      (6, 5, 1198, false, false, 'Carsten Giese'),
      (6, 6, 1129, false, true,  'Jamie Kingston Reinhardt'),
      (6, 7, 1121, false, false, 'Volker Multhaupt'),
      (6, 8, 974,  false, false, 'Nils Schüssler'),
      (6, 9, 967,  false, false, 'Umut Taskinsoy'),
      (6, 10, 873, false, true,  'Simon Gregert'),
      (6, 11, 719, false, false, 'Marco Schmitz'),
      (6, 12, 0,   false, true,  'Max Mühlbauer'),
      (6, 13, 0,   false, false, 'Tobias Niermann')
    ) as t(team, pos, qttr, res, sperr, name)
  loop
    select id into v_team from mannschaften where nummer = rec.team;

    insert into spieler (name, qttr, kanal, praeferenzen)
      values (rec.name, rec.qttr, 'telegram', '{}'::jsonb)
      returning id into v_sp;

    insert into meldungen (halbserie_id, mannschaft_id, spieler_id, position, sperrvermerk, res)
      values (v_hs, v_team, v_sp, rec.pos, rec.sperr, rec.res);

    insert into kader_status (halbserie_id, spieler_id, status)
      values (v_hs, v_sp, 'aktiv');
  end loop;

  -- Login von Carsten Schulte mit dem echten Spieler verknüpfen
  update spieler
    set email = 'carsten.schulte@gmail.com', dsgvo_einwilligung_am = now()
    where name = 'Carsten Schulte';
  update benutzer
    set spieler_id = (select id from spieler where name = 'Carsten Schulte' limit 1)
    where id = (select id from auth.users where email = 'carsten.schulte@gmail.com');

  raise notice 'Meldung Vorrunde 2026/27 importiert.';
end $$;
