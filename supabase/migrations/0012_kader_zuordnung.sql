-- =============================================================================
-- Aufstellungs-Assistent · Migration 0012 — Operativer Kader (Stamm + Favoriten)
--
-- Zweite Wahrheit, sauber neben der Meldung (SPEC A.1): Die offizielle
-- `meldungen` bleibt die formale Grundlage der Regel-Engine (Ersatz nur nach
-- oben). Der operative Kader steuert nur Planung/Abfrage.
--
--   rolle = 'stamm'   -> genau EINE Mannschaft je Spieler; wird automatisch
--                        gefragt, zählt als Kader. Default = Meldemannschaft,
--                        vom Admin verschiebbar.
--   rolle = 'favorit' -> beliebig viele Mannschaften; nur Anzeige/gezielt
--                        anfragbar. Von MF der eigenen Mannschaft pflegbar.
--
-- Etappe A: Tabelle + Seed + Kurierung. Die operativen Reads (Abfrage/Matrix)
-- hängen noch an der Meldung und werden erst in Etappe B umgestellt.
-- =============================================================================

create table if not exists kader_zuordnung (
  id             uuid primary key default gen_random_uuid(),
  halbserie_id   uuid not null references halbserien (id) on delete cascade,
  mannschaft_id  uuid not null references mannschaften (id) on delete cascade,
  spieler_id     uuid not null references spieler (id) on delete cascade,
  rolle          text not null check (rolle in ('stamm', 'favorit')),
  notiz          text,
  hinzugefuegt_von uuid references auth.users (id) on delete set null,
  hinzugefuegt_am  timestamptz not null default now(),
  -- Ein Spieler darf in einer Mannschaft nur einmal vorkommen (Stamm ODER Favorit)
  unique (halbserie_id, mannschaft_id, spieler_id)
);

-- Genau ein Stammplatz je Spieler und Halbserie
create unique index if not exists kader_zuordnung_ein_stamm
  on kader_zuordnung (halbserie_id, spieler_id)
  where rolle = 'stamm';

create index if not exists kader_zuordnung_team_idx
  on kader_zuordnung (halbserie_id, mannschaft_id);

-- --- Seed: jede bestehende Meldung wird zum Stammplatz ----------------------
-- Danach ist der operative Kader identisch mit der Meldung. Erst Kurierung
-- (Verschieben/Favoriten) lässt beide auseinanderlaufen.
insert into kader_zuordnung (halbserie_id, mannschaft_id, spieler_id, rolle)
select m.halbserie_id, m.mannschaft_id, m.spieler_id, 'stamm'
from meldungen m
on conflict (halbserie_id, mannschaft_id, spieler_id) do nothing;

-- --- RLS --------------------------------------------------------------------
alter table kader_zuordnung enable row level security;

-- Lesen: alle Angemeldeten (wie meldungen/kader_status)
create policy read_all_auth on kader_zuordnung
  for select to authenticated using (true);

-- Admin: darf alles (inkl. Stamm verschieben)
create policy admin_write on kader_zuordnung
  for all to authenticated
  using (app_is_admin())
  with check (app_is_admin());

-- MF: darf Favoriten der EIGENEN Mannschaft pflegen (kein Stamm)
create policy mf_favorit_write on kader_zuordnung
  for all to authenticated
  using (rolle = 'favorit' and mannschaft_id = any (app_mf_teams()))
  with check (rolle = 'favorit' and mannschaft_id = any (app_mf_teams()));

-- --- RPC: Stamm eines Spielers in eine Mannschaft verschieben (nur Admin) ----
-- Optional Favorit im alten Team hinterlassen. Läuft SECURITY DEFINER, damit
-- der Unique-Index/Constraint-Handling zentral bleibt.
create or replace function set_spieler_stamm(
  p_halbserie      uuid,
  p_ziel_team      uuid,
  p_spieler        uuid,
  p_favorit_im_alt boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_alt uuid;
begin
  if not app_is_admin() then
    raise exception 'Nur Admin darf den Stamm verschieben';
  end if;

  select mannschaft_id into v_alt
    from kader_zuordnung
    where halbserie_id = p_halbserie and spieler_id = p_spieler and rolle = 'stamm';

  -- Eine evtl. bestehende Favoriten-Zeile im Zielteam würde kollidieren
  delete from kader_zuordnung
    where halbserie_id = p_halbserie and mannschaft_id = p_ziel_team
      and spieler_id = p_spieler and rolle = 'favorit';

  if v_alt is null then
    insert into kader_zuordnung (halbserie_id, mannschaft_id, spieler_id, rolle)
    values (p_halbserie, p_ziel_team, p_spieler, 'stamm');
  else
    update kader_zuordnung
      set mannschaft_id = p_ziel_team
      where halbserie_id = p_halbserie and spieler_id = p_spieler and rolle = 'stamm';
  end if;

  if p_favorit_im_alt and v_alt is not null and v_alt <> p_ziel_team then
    insert into kader_zuordnung (halbserie_id, mannschaft_id, spieler_id, rolle)
    values (p_halbserie, v_alt, p_spieler, 'favorit')
    on conflict (halbserie_id, mannschaft_id, spieler_id) do nothing;
  end if;

  insert into audit_log (aktion, entitaet, entitaet_id, details)
  values ('stamm_verschoben', 'kader_zuordnung', p_spieler,
    jsonb_build_object('von', v_alt, 'nach', p_ziel_team, 'favorit_im_alt', p_favorit_im_alt));
end;
$$;

grant execute on function set_spieler_stamm(uuid, uuid, uuid, boolean) to authenticated;
