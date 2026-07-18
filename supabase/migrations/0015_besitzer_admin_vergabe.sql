-- =============================================================================
-- Aufstellungs-Assistent · Migration 0015 — Besitzer & Admin-Vergabe
--
-- Zwei Stufen:
--   • Admin (rollen enthält 'admin'): volle Verwaltungsrechte.
--   • Besitzer (benutzer.ist_owner = true): darf ZUSÄTZLICH Admin-Rechte
--     vergeben/entziehen. Ein normaler Admin kann KEINE Admins ernennen.
--
-- Das Besitzer-Kennzeichen wird bewusst nur direkt in der DB gesetzt (kein
-- UI-Schalter), damit es nicht versehentlich weitergereicht wird.
-- =============================================================================

alter table benutzer
  add column if not exists ist_owner boolean not null default false;

-- Ist der aktuelle Nutzer Besitzer?
create or replace function app_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce((select ist_owner from benutzer where id = auth.uid()), false);
$$;

-- Admin-Rolle eines Nutzers setzen/entfernen — nur der Besitzer darf das.
create or replace function set_user_admin(p_user uuid, p_ist_admin boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not app_is_owner() then
    raise exception 'Nur der Besitzer darf Admin-Rechte vergeben';
  end if;

  if p_ist_admin then
    update benutzer
      set rollen = case when 'admin' = any(rollen)
                        then rollen
                        else rollen || 'admin'::rolle_typ end
      where id = p_user;
  else
    -- Lockout-Schutz: dem Besitzer kann das Admin-Recht nicht entzogen werden.
    if exists (select 1 from benutzer where id = p_user and ist_owner) then
      raise exception 'Dem Besitzer kann das Admin-Recht nicht entzogen werden';
    end if;
    update benutzer
      set rollen = array_remove(rollen, 'admin'::rolle_typ)
      where id = p_user;
  end if;

  insert into audit_log (aktion, entitaet, entitaet_id, details)
  values ('admin_recht_geaendert', 'benutzer', p_user,
    jsonb_build_object('ist_admin', p_ist_admin));
end;
$$;

grant execute on function set_user_admin(uuid, boolean) to authenticated;

-- Initialen Besitzer festlegen (greift nur, wenn der Login bereits existiert).
update benutzer
  set ist_owner = true
  where id = (
    select id from auth.users where lower(email) = lower('carsten.schulte@gmail.com')
  );
