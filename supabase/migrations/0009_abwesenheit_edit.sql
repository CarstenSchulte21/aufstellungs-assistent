-- =============================================================================
-- Aufstellungs-Assistent · Migration 0009 — Abwesenheiten editierbar
--
-- Bisher (0007) hat der Trigger beim Bearbeiten einer Abwesenheit nur den NEUEN
-- Zeitraum abgesagt, aber Spiele, die aus dem Zeitraum herausfallen, blieben
-- fälschlich abgesagt. Diese Neufassung nimmt bei UPDATE/DELETE zuerst die alten
-- automatischen Absagen zurück und setzt dann den neuen Zeitraum.
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

  -- Alte automatische Absagen des bisherigen Zeitraums zurücknehmen
  if (tg_op = 'UPDATE' or tg_op = 'DELETE') then
    update verfuegbarkeiten v
      set status = 'nicht_angefragt', kommentar = null
    from spiele s
    where v.spiel_id = s.id
      and v.spieler_id = old.spieler_id
      and v.status = 'abgesagt'
      and v.kommentar = 'Abwesenheit'
      and s.datum between old.von and old.bis;
  end if;

  -- Neuen Zeitraum absagen
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
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

  return old;
end;
$$;
