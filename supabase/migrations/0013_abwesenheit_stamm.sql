-- =============================================================================
-- Aufstellungs-Assistent · Migration 0013 — Abwesenheit folgt dem Stamm
--
-- Etappe B: Die automatische Absage bei Abwesenheit betraf bisher die Spiele
-- der MELDEmannschaft. Operativ zählt aber der Stammplatz (kader_zuordnung).
-- Ein hochgezogener Spieler (z. B. gemeldet 3., Stamm 2.) sagt bei Abwesenheit
-- also die Spiele seiner STAMM-Mannschaft ab, nicht die der Meldung.
--
-- Nur die INSERT/UPDATE-Verzweigung ändert sich (Join meldungen -> Stamm).
-- =============================================================================

create or replace function apply_abwesenheit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hs uuid;
begin
  select id into v_hs from halbserien where aktiv limit 1;

  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    -- Alle Spiele der STAMM-Mannschaft des Spielers im Zeitraum absagen
    insert into verfuegbarkeiten (spiel_id, spieler_id, status, quelle, kommentar)
    select distinct s.id, new.spieler_id,
                    'abgesagt'::verfuegbarkeit_status, 'system'::quelle_typ, 'Abwesenheit'
    from spiele s
    join kader_zuordnung z
      on z.mannschaft_id = s.mannschaft_id
     and z.halbserie_id = s.halbserie_id
     and z.spieler_id = new.spieler_id
     and z.rolle = 'stamm'
    where s.halbserie_id = v_hs
      and s.datum between new.von and new.bis
    on conflict (spiel_id, spieler_id)
      do update set status = 'abgesagt'::verfuegbarkeit_status,
                    quelle = 'system'::quelle_typ,
                    kommentar = 'Abwesenheit';

    insert into audit_log (aktion, entitaet, entitaet_id, details)
    values ('abwesenheit_gesetzt', 'abwesenheiten', new.id,
      jsonb_build_object('spieler_id', new.spieler_id, 'von', new.von, 'bis', new.bis));
    return new;
  end if;

  if (tg_op = 'DELETE') then
    -- Nur automatisch gesetzte Absagen im alten Zeitraum zurücknehmen
    update verfuegbarkeiten v
      set status = 'nicht_angefragt', kommentar = null
    from spiele s
    where v.spiel_id = s.id
      and v.spieler_id = old.spieler_id
      and v.status = 'abgesagt'
      and v.kommentar = 'Abwesenheit'
      and s.datum between old.von and old.bis;
    return old;
  end if;

  return null;
end;
$$;
