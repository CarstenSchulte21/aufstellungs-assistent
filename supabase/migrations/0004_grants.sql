-- =============================================================================
-- Aufstellungs-Assistent · Migration 0004 — Tabellen-Freigaben (GRANTs)
--
-- Row Level Security (0002) filtert ZEILEN, ersetzt aber NICHT die
-- Grund-Berechtigung auf den Objekten. Ohne diese GRANTs bekommt die Rolle
-- `authenticated` ein "permission denied for table" (HTTP 403), bevor RLS
-- überhaupt greift — die Webapp zeigt dann trotz Login "keine Daten".
--
-- Sicherheit bleibt gewahrt: WAS die Rolle sieht/ändert, entscheiden weiterhin
-- allein die RLS-Policies aus 0002/0003.
-- =============================================================================

grant usage on schema public to authenticated;

-- Lesen + Schreiben auf allen Tabellen und Views (RLS filtert die Zeilen)
grant select, insert, update, delete
  on all tables in schema public to authenticated;

-- Sequenzen (z. B. audit_log.id)
grant usage, select on all sequences in schema public to authenticated;

-- Funktionen / RPCs (z. B. set_dsgvo_consent, Helper der Policies)
grant execute on all functions in schema public to authenticated;

-- Künftig angelegte Objekte automatisch mitberechtigen
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
