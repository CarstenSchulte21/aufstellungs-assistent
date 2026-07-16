-- =============================================================================
-- Aufstellungs-Assistent · Migration 0002 — Row Level Security (SPEC.md A.6)
--
-- Rollenmodell (aus benutzer.rollen / benutzer.mf_von_mannschaften):
--   Spieler         : liest alle Matrizen/Spielpläne; schreibt eigene
--                     Verfügbarkeiten & Abwesenheiten (als Proxy die des
--                     verknüpften Spielers).
--   Mannschaftsführer: liest alles; schreibt zusätzlich Kader-Status,
--                     Verfügbarkeiten und Freigaben *seiner* Mannschaft(en)
--                     sowie eigene regel_config.
--   Admin           : liest und schreibt alles.
--
-- WICHTIG: Der service_role-Key (Server/Bot/Scheduler/Seed) umgeht RLS
-- vollständig. Diese Policies gelten für eingeloggte Endnutzer (anon-Key
-- + Session).
--
-- HINWEIS zur Spalten-Maskierung (A.6, letzter Absatz): Freitext-Kommentare
-- (verfuegbarkeiten.kommentar, abwesenheiten.grund, kader_status.notiz) sind
-- sensibel. RLS wirkt zeilenweise, nicht spaltenweise — die Matrix zeigt allen
-- den Status, aber das "Warum" darf nur Spieler/MF/Admin sehen. Diese
-- Spalten-Maskierung wird beim Bau von Screen S3 (Meilenstein 2) über eine
-- SECURITY-DEFINER-View bzw. gezielte Spaltenauswahl umgesetzt. Der
-- Nachrichten-Store (nachrichten) ist dagegen bereits hier zeilenweise
-- abgeschottet, weil dort ausschließlich Freitext liegt.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper-Funktionen (SECURITY DEFINER, umgehen RLS -> keine Rekursion)
-- -----------------------------------------------------------------------------
create or replace function app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select 'admin' = any(rollen) from benutzer where id = auth.uid()),
    false
  );
$$;

create or replace function app_is_mf()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select 'mannschaftsfuehrer' = any(rollen) from benutzer where id = auth.uid()),
    false
  );
$$;

create or replace function app_mf_teams()
returns uuid[]
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select mf_von_mannschaften from benutzer where id = auth.uid()),
    array[]::uuid[]
  );
$$;

create or replace function app_my_spieler_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select spieler_id from benutzer where id = auth.uid();
$$;

-- Spieler, für die ich Proxy bin (die also mich als proxy_spieler_id führen).
create or replace function app_my_proxy_spieler_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    array(
      select s.id from spieler s
      where s.proxy_spieler_id = app_my_spieler_id()
    ),
    array[]::uuid[]
  );
$$;

-- Darf ich (Spieler/Proxy) für diesen Spieler schreiben?
create or replace function app_can_write_for_spieler(ziel uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select ziel = app_my_spieler_id()
      or ziel = any(app_my_proxy_spieler_ids());
$$;

-- Ist der Spieler (in der aktiven Halbserie) in einer meiner MF-Mannschaften gemeldet?
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

-- =============================================================================
-- RLS aktivieren
-- =============================================================================
alter table halbserien       enable row level security;
alter table spieler          enable row level security;
alter table mannschaften     enable row level security;
alter table benutzer         enable row level security;
alter table meldungen        enable row level security;
alter table kader_status     enable row level security;
alter table spiele           enable row level security;
alter table verfuegbarkeiten enable row level security;
alter table abwesenheiten    enable row level security;
alter table ersatzanfragen   enable row level security;
alter table einsaetze        enable row level security;
alter table regel_config     enable row level security;
alter table verlegungen      enable row level security;
alter table nachrichten      enable row level security;
alter table audit_log        enable row level security;

-- =============================================================================
-- Offen lesbare Stammdaten & Matrizen (Transparenz-Anforderung)
-- Alle eingeloggten Nutzer dürfen lesen.
-- =============================================================================
create policy read_all_auth on halbserien       for select to authenticated using (true);
create policy read_all_auth on spieler          for select to authenticated using (true);
create policy read_all_auth on mannschaften     for select to authenticated using (true);
create policy read_all_auth on meldungen        for select to authenticated using (true);
create policy read_all_auth on kader_status     for select to authenticated using (true);
create policy read_all_auth on spiele           for select to authenticated using (true);
create policy read_all_auth on verfuegbarkeiten for select to authenticated using (true);
create policy read_all_auth on abwesenheiten    for select to authenticated using (true);
create policy read_all_auth on ersatzanfragen   for select to authenticated using (true);
create policy read_all_auth on einsaetze        for select to authenticated using (true);
create policy read_all_auth on regel_config     for select to authenticated using (true);
create policy read_all_auth on verlegungen      for select to authenticated using (true);

-- =============================================================================
-- benutzer — eigenes Profil + Admin sieht alles
-- =============================================================================
create policy benutzer_read_own on benutzer
  for select to authenticated
  using (id = auth.uid() or app_is_admin());

create policy benutzer_admin_write on benutzer
  for all to authenticated
  using (app_is_admin())
  with check (app_is_admin());

-- =============================================================================
-- Admin darf alle Stammdaten schreiben
-- =============================================================================
create policy admin_write on halbserien   for all to authenticated using (app_is_admin()) with check (app_is_admin());
create policy admin_write on spieler       for all to authenticated using (app_is_admin()) with check (app_is_admin());
create policy admin_write on mannschaften  for all to authenticated using (app_is_admin()) with check (app_is_admin());
create policy admin_write on meldungen     for all to authenticated using (app_is_admin()) with check (app_is_admin());
create policy admin_write on spiele        for all to authenticated using (app_is_admin()) with check (app_is_admin());
create policy admin_write on einsaetze     for all to authenticated using (app_is_admin()) with check (app_is_admin());
create policy admin_write on verlegungen   for all to authenticated using (app_is_admin()) with check (app_is_admin());

-- =============================================================================
-- kader_status — Admin (oben) + MF seiner Mannschaften
-- =============================================================================
create policy mf_write on kader_status
  for all to authenticated
  using (app_is_admin() or app_mf_owns_spieler(spieler_id))
  with check (app_is_admin() or app_mf_owns_spieler(spieler_id));

-- =============================================================================
-- verfuegbarkeiten — Spieler/Proxy (eigene) + MF (Spiele seiner Mannschaft) + Admin
-- =============================================================================
create policy self_write on verfuegbarkeiten
  for all to authenticated
  using (app_can_write_for_spieler(spieler_id))
  with check (app_can_write_for_spieler(spieler_id));

create policy mf_write on verfuegbarkeiten
  for all to authenticated
  using (
    app_is_admin()
    or exists (
      select 1 from spiele s
      where s.id = verfuegbarkeiten.spiel_id
        and s.mannschaft_id = any(app_mf_teams())
    )
  )
  with check (
    app_is_admin()
    or exists (
      select 1 from spiele s
      where s.id = verfuegbarkeiten.spiel_id
        and s.mannschaft_id = any(app_mf_teams())
    )
  );

-- =============================================================================
-- abwesenheiten — Spieler/Proxy (eigene) + Admin
-- =============================================================================
create policy self_write on abwesenheiten
  for all to authenticated
  using (app_is_admin() or app_can_write_for_spieler(spieler_id))
  with check (app_is_admin() or app_can_write_for_spieler(spieler_id));

-- =============================================================================
-- ersatzanfragen — Freigaben durch MF der betroffenen Mannschaft + Admin
-- =============================================================================
create policy mf_write on ersatzanfragen
  for all to authenticated
  using (
    app_is_admin()
    or exists (
      select 1 from spiele s
      where s.id = ersatzanfragen.spiel_id
        and s.mannschaft_id = any(app_mf_teams())
    )
  )
  with check (
    app_is_admin()
    or exists (
      select 1 from spiele s
      where s.id = ersatzanfragen.spiel_id
        and s.mannschaft_id = any(app_mf_teams())
    )
  );

-- =============================================================================
-- regel_config — MF seiner eigenen Mannschaft + Admin
-- =============================================================================
create policy mf_write on regel_config
  for all to authenticated
  using (app_is_admin() or mannschaft_id = any(app_mf_teams()))
  with check (app_is_admin() or mannschaft_id = any(app_mf_teams()));

-- =============================================================================
-- nachrichten — sensibel: nur betroffener Spieler, dessen MF, Admin
-- =============================================================================
create policy nachrichten_read on nachrichten
  for select to authenticated
  using (
    app_is_admin()
    or spieler_id = app_my_spieler_id()
    or app_mf_owns_spieler(spieler_id)
  );

create policy nachrichten_admin_write on nachrichten
  for all to authenticated
  using (app_is_admin())
  with check (app_is_admin());

-- =============================================================================
-- audit_log — nur Admin liest; alle eingeloggten dürfen anhängen (Nachweis)
-- =============================================================================
create policy audit_read_admin on audit_log
  for select to authenticated
  using (app_is_admin());

create policy audit_insert on audit_log
  for insert to authenticated
  with check (true);
