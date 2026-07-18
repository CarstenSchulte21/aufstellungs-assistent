-- =============================================================================
-- Aufstellungs-Assistent · Migration 0014 — Spieler pflegt eigene Präferenzen
--
-- Bisher konnten nur MF/Admin Präferenzen setzen. Ein Spieler soll seine
-- eigenen Präferenzen (nur Heimspiele / keine Doppeleinsätze) selbst pflegen
-- dürfen — aber NUR seine eigene Zeile und nur das Präferenzen-Feld. Deshalb
-- ein enger SECURITY-DEFINER-Aufruf statt einer breiten Schreibregel.
-- =============================================================================

create or replace function set_my_praeferenzen(p_praeferenzen jsonb)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_sp uuid;
begin
  v_sp := app_my_spieler_id();
  if v_sp is null then
    raise exception 'Kein Spielerprofil mit diesem Login verknüpft';
  end if;
  update spieler
    set praeferenzen = coalesce(p_praeferenzen, '{}'::jsonb)
    where id = v_sp;
end;
$$;

grant execute on function set_my_praeferenzen(jsonb) to authenticated;
