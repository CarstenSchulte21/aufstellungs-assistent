-- =============================================================================
-- Aufstellungs-Assistent · Migration 0011 — Onboarding-Merker
--
-- Merkt, ob ein Nutzer den Willkommens-/Info-Screen schon gesehen hat, damit er
-- nur beim ersten Login automatisch erscheint. Danach ist er über /info
-- jederzeit erreichbar.
-- =============================================================================

alter table benutzer
  add column if not exists onboarding_gesehen boolean not null default false;

-- Nutzer markiert für sich selbst, dass der Willkommensscreen gesehen wurde.
create or replace function mark_onboarding_seen()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update benutzer set onboarding_gesehen = true where id = auth.uid();
end;
$$;

grant execute on function mark_onboarding_seen() to authenticated;
