-- =============================================================================
-- Aufstellungs-Assistent · Migration 0007 — Automatische Systemreaktionen (M4)
--
-- 1. Abwesenheit -> betroffene Spiele automatisch auf "abgesagt" (SPEC A.4).
-- 2. Kader-Status pausiert/inaktiv -> offene Abfragen & Ersatzanfragen des
--    Spielers zurücknehmen (SPEC kader_status).
--
-- Beides als deterministische Trigger (kein LLM), SECURITY DEFINER, damit sie
-- unabhängig vom Eintragsweg (Webapp, Bot, Proxy) greifen.
-- =============================================================================

-- --- 1. Abwesenheit -> Verfügbarkeiten -------------------------------------
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
    -- Alle Spiele der Mannschaft(en) des Spielers im Abwesenheitszeitraum absagen
    insert into verfuegbarkeiten (spiel_id, spieler_id, status, quelle, kommentar)
    select distinct s.id, new.spieler_id,
                    'abgesagt'::verfuegbarkeit_status, 'system'::quelle_typ, 'Abwesenheit'
    from spiele s
    join meldungen m
      on m.mannschaft_id = s.mannschaft_id
     and m.halbserie_id = s.halbserie_id
     and m.spieler_id = new.spieler_id
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

drop trigger if exists trg_abwesenheit on abwesenheiten;
create trigger trg_abwesenheit
  after insert or update or delete on abwesenheiten
  for each row execute function apply_abwesenheit();

-- --- 2. Kader-Status pausiert/inaktiv -> Rücknahmen -------------------------
create or replace function apply_kader_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.status in ('pausiert', 'inaktiv')
     and new.status is distinct from old.status then

    -- Offene Abfragen (nur künftige Spiele) zurücknehmen
    update verfuegbarkeiten v
      set status = 'nicht_angefragt'
    from spiele s
    where v.spiel_id = s.id
      and v.spieler_id = new.spieler_id
      and v.status in ('angefragt', 'erinnert')
      and s.halbserie_id = new.halbserie_id
      and s.datum >= current_date;

    -- Offene Ersatzanfragen zurückziehen (löst auch den Lock)
    update ersatzanfragen
      set status = 'zurueckgezogen'
    where spieler_id = new.spieler_id
      and status in ('vorgeschlagen', 'freigegeben', 'gesendet');

    insert into audit_log (aktion, entitaet, entitaet_id, details)
    values ('status_geaendert', 'kader_status', new.id,
      jsonb_build_object('alt', old.status, 'neu', new.status,
        'wirkung', 'offene Abfragen und Ersatzanfragen zurückgenommen'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_kader_status on kader_status;
create trigger trg_kader_status
  after update on kader_status
  for each row execute function apply_kader_status();
