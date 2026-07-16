-- =============================================================================
-- Aufstellungs-Assistent · Seed (DEMO-Daten)
--
-- Erzeugt: 1 aktive Halbserie (DEMO), 6 Mannschaften (1. = Sechser/
-- Bezirksoberliga, 2.–6. = Vierer), ~40 Demo-Spieler mit Meldung und
-- Kader-Status, einen Demo-Spielplan der Hinrunde je Mannschaft, gestreute
-- Verfügbarkeiten, Regelkonfiguration je Mannschaft und ein paar Ersatz-
-- einsätze.
--
-- ALLES ist als DEMO markiert und leicht entfernbar:
--   - Halbserie:  bezeichnung endet auf "(DEMO)"  -> Löschen kaskadiert
--                 Meldungen, Kader-Status, Spiele, Verfügbarkeiten,
--                 Einsätze, Regelkonfiguration.
--   - Spieler:    praeferenzen ->> '_demo' = 'true'
-- Aufräumen mit supabase/seed_teardown.sql (Mannschaften bleiben erhalten).
--
-- Läuft über den service_role-Key (SQL Editor im Dashboard oder CLI) und
-- umgeht damit RLS. Idempotent: räumt zuerst vorhandene Demo-Daten weg.
-- =============================================================================

-- Vorherige Demo-Daten entfernen (idempotent) -------------------------------
delete from einsaetze
  where spieler_id in (select id from spieler where praeferenzen->>'_demo' = 'true');
delete from halbserien where bezeichnung like '%(DEMO)%';
delete from spieler where praeferenzen->>'_demo' = 'true';
-- Mannschaften bleiben bestehen (echte Vereinsstruktur); MF-Verweis wird
-- durch on delete set null automatisch gelöst.

do $$
declare
  v_names text[] := array[
    'Andreas Berger','Bernd Hoffmann','Christian Wagner','Dieter Krüger',
    'Erik Schneider','Frank Zimmermann','Georg Lehmann','Holger Braun',
    'Ingo Weber','Jens Fischer','Klaus Richter','Lars Wolf',
    'Markus Neumann','Norbert Schwarz','Oliver Köhler','Peter Hartmann',
    'Ralf Sommer','Sven Böhm','Thomas Vogel','Uwe Kaiser',
    'Volker Lang','Werner Busch','Alexander Otto','Bastian Frank',
    'Carsten Schulte','Daniel Arndt','Emil Roth','Florian Kern',
    'Gerd Peters','Hendrik Voss','Ivo Marx','Jan Seidel',
    'Kai Brandt','Leon Horn','Malte Ziegler','Niklas Engel',
    'Oskar Beck','Pascal Winter','Robert Sonntag','Stefan Adler',
    'Tobias Ernst','Ulrich Graf'
  ];
  v_gegner text[] := array[
    'TTC Blau-Weiß Ahlen','SV Post Dortmund','DJK Grün-Weiß Werl',
    'TuS Hamm 09','SC Preußen Lünen','VfL Kamen','TTV Unna',
    'SG Bönen','TB Witten','FC Schwerte'
  ];
  v_liga text[] := array[
    'Bezirksoberliga','Bezirksklasse','1. Kreisklasse',
    '1. Kreisklasse','2. Kreisklasse','2. Kreisklasse'
  ];
  v_team_size int[] := array[8, 6, 6, 6, 6, 6]; -- gemeldete Spieler je Mannschaft
  v_staerke   int[] := array[6, 4, 4, 4, 4, 4]; -- benötigte Spieler (Sechser/Vierer)

  v_hs      uuid;
  v_tid     uuid;
  v_pid     uuid;
  v_sid     uuid;
  v_players uuid[];
  v_teams   uuid[] := array[]::uuid[];
  name_idx  int := 1;
  t int; p int; g int; i int; r int;
  v_status verfuegbarkeit_status;
  v_kader  kader_status_typ;
  v_datum  date;
  v_qttr   int;
  v_komm   text;
begin
  -- Halbserie ---------------------------------------------------------------
  insert into halbserien (bezeichnung, start, ende, aktiv)
    values ('Hinrunde 2026/27 (DEMO)', date '2026-09-01', date '2026-12-31', true)
    returning id into v_hs;

  -- Mannschaften + Spieler + Meldung + Kader-Status -------------------------
  for t in 1..6 loop
    insert into mannschaften (nummer, name, liga, spielstaerke)
      values (t, t || '. Mannschaft', v_liga[t], v_staerke[t])
      on conflict (nummer) do update
        set name = excluded.name,
            liga = excluded.liga,
            spielstaerke = excluded.spielstaerke
      returning id into v_tid;

    v_teams := array_append(v_teams, v_tid);
    v_players := array[]::uuid[];

    for p in 1..v_team_size[t] loop
      v_qttr := 1650 - (t - 1) * 90 - (p - 1) * 18;

      insert into spieler (name, email, kanal, qttr, praeferenzen, dsgvo_einwilligung_am)
        values (
          v_names[name_idx],
          lower(replace(split_part(v_names[name_idx], ' ', 1), 'ü','ue'))
            || '.demo' || name_idx || '@example.org',
          case when p % 3 = 0 then 'webapp'::kanal_typ else 'telegram'::kanal_typ end,
          v_qttr,
          jsonb_build_object('_demo', true)
            || case when p = 2 then '{"nur_heimspiele": true}'::jsonb else '{}'::jsonb end,
          case when p % 5 = 0 then null else now() end  -- ein paar ohne DSGVO-Einwilligung
        )
        returning id into v_pid;

      name_idx := name_idx + 1;
      v_players := array_append(v_players, v_pid);

      -- Meldung: Position = p, RES für Positionen über der Spielstärke
      insert into meldungen (halbserie_id, mannschaft_id, spieler_id, position, sperrvermerk, res)
        values (v_hs, v_tid, v_pid, p, false, p > v_staerke[t]);

      -- Kader-Status: überwiegend aktiv, je ein Demo-Sonderfall
      v_kader := case
        when t = 2 and p = 6 then 'pausiert'::kader_status_typ
        when t = 4 and p = 6 then 'inaktiv'::kader_status_typ
        else 'aktiv'::kader_status_typ
      end;

      insert into kader_status (halbserie_id, spieler_id, status, pausiert_bis, notiz)
        values (
          v_hs, v_pid, v_kader,
          case when v_kader = 'pausiert' then date '2026-11-01' else null end,
          case when v_kader = 'pausiert' then 'Knie-OP, kommt voraussichtlich zurück'
               when v_kader = 'inaktiv'  then 'Aktuell beruflich verhindert'
               else null end
        );
    end loop;

    -- Mannschaftsführer = Positions-1-Spieler
    update mannschaften set mannschaftsfuehrer_id = v_players[1] where id = v_tid;

    -- Spielplan Hinrunde: 9 Spieltage im 14-Tage-Rhythmus ------------------
    for g in 1..9 loop
      v_datum := date '2026-09-12' + ((g - 1) * 14);

      insert into spiele
        (halbserie_id, mannschaft_id, spieltag_nr, datum, uhrzeit, heim, gegner, ort, status)
        values (
          v_hs, v_tid, g, v_datum, time '19:00',
          ((g + t) % 2 = 0),                       -- Heim/Auswärts wechselnd
          v_gegner[1 + ((g + t) % array_length(v_gegner, 1))],
          case when ((g + t) % 2 = 0) then 'Vereinsheim, Halle 1' else null end,
          'geplant'
        )
        returning id into v_sid;

      -- Verfügbarkeiten je gemeldetem Spieler (gestreute Demo-Stati)
      for i in 1..array_length(v_players, 1) loop
        r := (i * 7 + g * 3) % 10;
        v_status := case
          when r <= 3 then 'zugesagt'::verfuegbarkeit_status
          when r <= 5 then 'abgesagt'::verfuegbarkeit_status
          when r = 6  then 'unsicher'::verfuegbarkeit_status
          when r = 7  then 'angefragt'::verfuegbarkeit_status
          when r = 8  then 'keine_antwort'::verfuegbarkeit_status
          else 'nicht_angefragt'::verfuegbarkeit_status
        end;

        v_komm := case
          when v_status = 'abgesagt' and (i + g) % 4 = 0 then 'Urlaub bis 20.09.'
          when v_status = 'unsicher' then 'Sagt oft erst kurzfristig zu'
          else null
        end;

        insert into verfuegbarkeiten (spiel_id, spieler_id, status, kommentar, quelle, erinnert_count)
          values (
            v_sid, v_players[i], v_status, v_komm,
            case when v_status in ('zugesagt','abgesagt','unsicher')
                 then 'telegram_button'::quelle_typ else 'system'::quelle_typ end,
            case when v_status = 'keine_antwort' then 2 else 0 end
          );
      end loop;
    end loop;

    -- Regelkonfiguration je Mannschaft (Defaults gem. SPEC A.4) ------------
    insert into regel_config (mannschaft_id, halbserie_id, config)
      values (
        v_tid, v_hs,
        jsonb_build_object(
          'kaskade', case
            when t < 6 then jsonb_build_array('M' || (t + 1), 'M' || least(t + 2, 6))
            else jsonb_build_array() end,
          'kaskade_sortierung', 'position',
          'tabu_spieler', jsonb_build_array(),
          'max_ersatzeinsaetze_pro_spieler', 2,
          'doppeleinsatz_erlauben', 'nur_mit_zustimmung',
          'vorlauf_erstabfrage_tage', 28,
          'reminder_nach_stunden', 48,
          'max_reminder', 2,
          'ersatz_antwortfrist_stunden', 48
        )
      );
  end loop;

  -- Zwei "Karteileichen" (inaktiv, nicht gemeldet) --------------------------
  for p in 1..2 loop
    insert into spieler (name, kanal, qttr, praeferenzen)
      values (v_names[name_idx], 'webapp', 1200, jsonb_build_object('_demo', true))
      returning id into v_pid;
    name_idx := name_idx + 1;
    insert into kader_status (halbserie_id, spieler_id, status, notiz)
      values (v_hs, v_pid, 'inaktiv', 'Karteileiche seit 2024');
  end loop;

  -- Ein paar Ersatzeinsätze (Spieler aus der 2. hilft in der 1. aus) --------
  insert into einsaetze (halbserie_id, spieler_id, mannschaft_id, datum, ersatz, quelle)
  select v_hs, m2.spieler_id, m1.mannschaft_id,
         date '2026-09-12' + ((row_number() over () - 1) * 28)::int, true, 'system'
  from meldungen m2
  join mannschaften t2 on t2.id = m2.mannschaft_id and t2.nummer = 2
  cross join lateral (
    select id as mannschaft_id from mannschaften where nummer = 1
  ) m1
  where m2.halbserie_id = v_hs and m2.position <= 3;

  raise notice 'Seed abgeschlossen: % Spieler angelegt.', name_idx - 1;
end $$;
