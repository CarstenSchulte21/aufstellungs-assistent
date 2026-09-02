-- =============================================================================
-- Aufstellungs-Assistent · Migration 0018 — Konto-Selbstheilung
--
-- Problem: Die Verknüpfung Konto -> Spieler entsteht nur einmal, beim Anlegen
-- des Auth-Kontos (Trigger handle_new_user, Migration 0003). Wird die E-Mail
-- eines Spielers erst NACH dessen Registrierung korrigiert, passt sie zum
-- Registrierungszeitpunkt nicht — die Verknüpfung bleibt leer, und der Spieler
-- sieht dauerhaft "noch keinem Spieler zugeordnet".
--
-- Lösung: link_my_spieler() verknüpft das aktuelle Konto bei Bedarf erneut
-- über die E-Mail. Wird bei jedem Login aufgerufen, solange noch keine
-- Verknüpfung besteht (siehe src/lib/auth.ts). Idempotent und ungefährlich.
-- =============================================================================

create or replace function link_my_spieler()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid     uuid := auth.uid();
  v_spieler uuid;
  v_email   text;
begin
  if v_uid is null then
    return null;
  end if;

  -- Profilzeile sicherstellen (falls sie aus irgendeinem Grund fehlt).
  insert into public.benutzer (id, rollen)
  values (v_uid, array['spieler']::rolle_typ[])
  on conflict (id) do nothing;

  -- Schon verknüpft? Dann nichts tun.
  select spieler_id into v_spieler from public.benutzer where id = v_uid;
  if v_spieler is not null then
    return v_spieler;
  end if;

  -- E-Mail des Kontos holen und passenden Spieler suchen.
  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is null then
    return null;
  end if;

  select id into v_spieler
    from public.spieler
    where lower(email) = v_email
    limit 1;
  if v_spieler is null then
    return null;
  end if;

  update public.benutzer
    set spieler_id = v_spieler
    where id = v_uid
      and spieler_id is null;

  return v_spieler;
end;
$$;

grant execute on function link_my_spieler() to authenticated;

-- Einmalige Nachverknüpfung für alle bereits betroffenen Konten
-- (z. B. Noah): jedes noch offene Konto, dessen E-Mail inzwischen zu einem
-- Spieler passt, wird direkt verknüpft.
update public.benutzer b
   set spieler_id = s.id
  from public.spieler s, auth.users u
 where b.id = u.id
   and b.spieler_id is null
   and lower(s.email) = lower(u.email);
