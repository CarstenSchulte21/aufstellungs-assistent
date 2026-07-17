-- =============================================================================
-- Aufstellungs-Assistent · Migration 0006 — Tabellen-Freigaben für service_role
--
-- Der serverseitige Bot-/Scheduler-Code nutzt den service_role-Key. In diesem
-- Projekt werden die Grundberechtigungen nicht automatisch vergeben (siehe
-- schon 0004 für `authenticated`), daher hier explizit für `service_role` —
-- sonst: "permission denied for table ...".
--
-- service_role umgeht RLS ohnehin; diese GRANTs geben nur die Grund-
-- berechtigung auf den Objekten.
-- =============================================================================

grant usage on schema public to service_role;

grant select, insert, update, delete
  on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to service_role;

grant execute on all functions in schema public to service_role;

-- Künftig angelegte Objekte automatisch mitberechtigen
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;
