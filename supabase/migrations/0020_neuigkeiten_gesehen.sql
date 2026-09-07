-- =============================================================================
-- Aufstellungs-Assistent · Migration 0020 — Neuigkeiten-Merker
--
-- Für die rollengefilterte „Was ist neu"-Karte auf der Startseite: je Konto
-- merken wir uns, wann der Nutzer die Neuigkeiten zuletzt als gelesen markiert
-- hat. Einträge, die neuer sind (und zur Rolle passen), gelten als ungelesen.
-- Die Neuigkeiten selbst stehen im Code (src/lib/neuigkeiten.ts), nicht in der
-- DB — leicht zu pflegen, keine Migration je Eintrag nötig.
-- =============================================================================

alter table benutzer
  add column if not exists neuigkeiten_gesehen_am timestamptz;

-- Der Nutzer markiert seine Neuigkeiten selbst als gelesen.
create or replace function mark_neuigkeiten_gesehen()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.benutzer
    set neuigkeiten_gesehen_am = now()
    where id = auth.uid();
end;
$$;

grant execute on function mark_neuigkeiten_gesehen() to authenticated;
