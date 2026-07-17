-- =============================================================================
-- Aufstellungs-Assistent · Migration 0010 — Mannschaftsführung
--
-- MF-Rechte hängen jetzt an der Mannschaft (Führer + Stellvertreter als
-- Spieler), nicht mehr an benutzer.mf_von_mannschaften. Vorteil: Der Admin
-- kann MF/Stellvertreter zuweisen, unabhängig davon, ob die Person sich schon
-- eingeloggt hat. Die Rechte greifen automatisch, sobald ihr Login mit dem
-- Spieler verknüpft ist.
--
-- Die RLS-Helper werden neu definiert, sodass sie MF-Zugehörigkeit aus
-- mannschaften.mannschaftsfuehrer_id / stellv_mf_id ableiten.
-- =============================================================================

alter table mannschaften
  add column if not exists stellv_mf_id uuid references spieler (id) on delete set null;

-- MF-Mannschaften des aktuellen Nutzers (Führer ODER Stellvertreter)
create or replace function app_mf_teams()
returns uuid[]
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    array(
      select id from mannschaften
      where mannschaftsfuehrer_id = app_my_spieler_id()
         or stellv_mf_id = app_my_spieler_id()
    ),
    array[]::uuid[]
  );
$$;

create or replace function app_is_mf()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from mannschaften
    where mannschaftsfuehrer_id = app_my_spieler_id()
       or stellv_mf_id = app_my_spieler_id()
  );
$$;

-- Ist der Zielspieler in einer meiner MF-Mannschaften gemeldet (aktive Halbserie)?
create or replace function app_mf_owns_spieler(ziel uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from meldungen m
    join halbserien h on h.id = m.halbserie_id and h.aktiv
    where m.spieler_id = ziel
      and m.mannschaft_id = any(app_mf_teams())
  );
$$;

-- Admin setzt MF und Stellvertreter einer Mannschaft (Spieler-IDs, nullable)
create or replace function set_team_mf(
  p_mannschaft uuid,
  p_mf         uuid,
  p_stellv     uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not app_is_admin() then
    raise exception 'Nur Admin darf die Mannschaftsführung ändern';
  end if;
  update mannschaften
    set mannschaftsfuehrer_id = p_mf,
        stellv_mf_id = p_stellv
    where id = p_mannschaft;

  insert into audit_log (aktion, entitaet, entitaet_id, details)
  values ('mf_gesetzt', 'mannschaften', p_mannschaft,
    jsonb_build_object('mf', p_mf, 'stellv', p_stellv));
end;
$$;

grant execute on function set_team_mf(uuid, uuid, uuid) to authenticated;
