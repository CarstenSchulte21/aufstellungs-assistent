-- =============================================================================
-- Aufstellungs-Assistent · Migration 0008 — MF darf Stammdaten pflegen (S2)
--
-- Produktentscheid: Der Mannschaftsführer pflegt bei Spielern SEINER Mannschaft
-- Kanal, Präferenzen, Kontakt und Proxy. Um A.6 nicht mit einem breiten
-- Schreibrecht auf `spieler` aufzuweichen (das würde ALLE Spalten öffnen),
-- läuft das über eine eng begrenzte SECURITY-DEFINER-Funktion, die nur diese
-- Felder ändert und die Berechtigung selbst prüft.
-- =============================================================================

create or replace function mf_update_spieler(
  p_spieler_id       uuid,
  p_kanal            kanal_typ,
  p_praeferenzen     jsonb,
  p_telefon          text,
  p_email            text,
  p_proxy_spieler_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (app_is_admin() or app_mf_owns_spieler(p_spieler_id)) then
    raise exception 'Nicht berechtigt, diesen Spieler zu bearbeiten';
  end if;

  update spieler set
    kanal            = coalesce(p_kanal, kanal),
    praeferenzen     = coalesce(p_praeferenzen, praeferenzen),
    telefon          = p_telefon,
    email            = p_email,
    proxy_spieler_id = p_proxy_spieler_id
  where id = p_spieler_id;

  insert into audit_log (aktion, entitaet, entitaet_id, details)
  values ('stammdaten_geaendert', 'spieler', p_spieler_id,
    jsonb_build_object('kanal', p_kanal, 'via', 'mf_update_spieler'));
end;
$$;

grant execute on function
  mf_update_spieler(uuid, kanal_typ, jsonb, text, text, uuid)
  to authenticated;
