-- =============================================================================
-- Aufstellungs-Assistent · Migration 0003 — Auth-Profil, Consent, Matrix-View
--
-- Ergänzt zu Meilenstein 2:
--   1. Automatisches benutzer-Profil beim ersten Login (Trigger auf auth.users),
--      inkl. Verknüpfung zu einem spieler bei Email-Übereinstimmung.
--   2. RPC set_dsgvo_consent() — Spieler bestätigt die DSGVO-Einwilligung selbst.
--   3. View v_verfuegbarkeiten — maskiert den sensiblen Freitext-Kommentar
--      (nur Spieler selbst, sein MF, Admin sehen ihn) -> löst den offenen Punkt
--      aus Meilenstein 1 (SPEC A.6, letzter Absatz).
--   4. verfuegbarkeiten in die Realtime-Publication -> Live-Updates der Matrix.
-- =============================================================================

-- 1. Profil-Bootstrap ---------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.benutzer (id, spieler_id, rollen)
  values (
    new.id,
    (select id from public.spieler where lower(email) = lower(new.email) limit 1),
    array['spieler']::rolle_typ[]
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 2. DSGVO-Einwilligung selbst setzen ----------------------------------------
create or replace function set_dsgvo_consent()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_spieler uuid;
begin
  select spieler_id into v_spieler from public.benutzer where id = auth.uid();
  if v_spieler is null then
    raise exception 'Kein verknüpfter Spieler für diesen Account.';
  end if;
  update public.spieler
    set dsgvo_einwilligung_am = now()
    where id = v_spieler;
end;
$$;

grant execute on function set_dsgvo_consent() to authenticated;

-- 3. Matrix-View mit Kommentar-Maskierung ------------------------------------
-- security_invoker = true -> RLS von verfuegbarkeiten greift weiter (Zeilen),
-- die CASE-Maske blendet nur die Freitext-Spalte für Unbefugte aus.
create or replace view v_verfuegbarkeiten
  with (security_invoker = true) as
select
  v.id,
  v.spiel_id,
  v.spieler_id,
  v.status,
  case
    when app_is_admin()
      or v.spieler_id = app_my_spieler_id()
      or app_mf_owns_spieler(v.spieler_id)
    then v.kommentar
    else null
  end as kommentar,
  v.quelle,
  v.erinnert_count,
  v.eingetragen_von,
  v.updated_at
from verfuegbarkeiten v;

grant select on v_verfuegbarkeiten to authenticated;

-- 4. Realtime für die Matrix --------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table verfuegbarkeiten;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
