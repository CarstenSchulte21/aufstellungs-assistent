-- =============================================================================
-- Aufstellungs-Assistent · Migration 0001 — Schema (SPEC.md Teil A)
-- Enums (A.3), Tabellen (A.4), Constraints und der Ersatz-Lock-Index (A.4).
-- RLS-Policies stehen in 0002_rls.sql, Seed-Daten in supabase/seed.sql.
-- =============================================================================

-- gen_random_uuid() ist in Supabase/PG13+ verfügbar (pgcrypto).
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- A.3 Enums
-- -----------------------------------------------------------------------------
create type kader_status_typ as enum ('aktiv', 'pausiert', 'inaktiv');

create type kanal_typ as enum ('telegram', 'webapp', 'proxy', 'email');

create type verfuegbarkeit_status as enum (
  'nicht_angefragt', 'angefragt', 'erinnert', 'zugesagt',
  'unsicher', 'abgesagt', 'keine_antwort', 'extern_verplant'
);

create type anfrage_status as enum (
  'vorgeschlagen', 'freigegeben', 'gesendet', 'zugesagt',
  'abgelehnt', 'abgelaufen', 'zurueckgezogen', 'eingeplant'
);

create type spiel_status as enum (
  'geplant', 'verlegung_angefragt', 'verlegt', 'gespielt', 'abgesetzt'
);

create type rolle_typ as enum ('admin', 'mannschaftsfuehrer', 'spieler');

create type quelle_typ as enum (
  'telegram_button', 'telegram_text', 'webapp', 'proxy', 'system', 'admin'
);

-- -----------------------------------------------------------------------------
-- Generischer updated_at-Trigger
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- halbserien
-- -----------------------------------------------------------------------------
create table halbserien (
  id          uuid primary key default gen_random_uuid(),
  bezeichnung text not null,
  start       date not null,
  ende        date not null,
  aktiv       boolean not null default false
);

-- Genau eine aktive Halbserie erzwingen (Teilbedingung auf aktiv = true).
create unique index halbserien_genau_eine_aktive
  on halbserien (aktiv)
  where aktiv = true;

-- -----------------------------------------------------------------------------
-- spieler
-- -----------------------------------------------------------------------------
create table spieler (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  telefon               text,
  email                 text,
  telegram_chat_id      bigint,
  kanal                 kanal_typ not null default 'telegram',
  proxy_spieler_id      uuid references spieler (id) on delete set null,
  qttr                  int not null default 0,
  praeferenzen          jsonb not null default '{}'::jsonb,
  dsgvo_einwilligung_am timestamptz,
  created_at            timestamptz not null default now()
);

comment on column spieler.proxy_spieler_id is
  'Wer stellvertretend für diesen Spieler einträgt (Edge Case "kein Smartphone").';

-- -----------------------------------------------------------------------------
-- mannschaften
-- -----------------------------------------------------------------------------
create table mannschaften (
  id                    uuid primary key default gen_random_uuid(),
  nummer                int not null unique,
  name                  text not null,
  liga                  text,
  spielstaerke          int not null,  -- 6 = Sechser, 4 = Vierer
  mannschaftsfuehrer_id uuid references spieler (id) on delete set null
);

-- -----------------------------------------------------------------------------
-- benutzer (Profil zu Supabase auth.users)
-- -----------------------------------------------------------------------------
create table benutzer (
  id                  uuid primary key references auth.users (id) on delete cascade,
  spieler_id          uuid references spieler (id) on delete set null,
  rollen              rolle_typ[] not null default array['spieler']::rolle_typ[],
  mf_von_mannschaften uuid[] not null default array[]::uuid[]
);

-- -----------------------------------------------------------------------------
-- meldungen — offizielle Mannschaftsmeldung (formale Ebene)
-- -----------------------------------------------------------------------------
create table meldungen (
  id           uuid primary key default gen_random_uuid(),
  halbserie_id uuid not null references halbserien (id) on delete cascade,
  mannschaft_id uuid not null references mannschaften (id) on delete cascade,
  spieler_id   uuid not null references spieler (id) on delete cascade,
  position     int not null,
  sperrvermerk boolean not null default false,
  res          boolean not null default false,
  unique (halbserie_id, spieler_id)
);

-- -----------------------------------------------------------------------------
-- kader_status — operative Ebene
-- -----------------------------------------------------------------------------
create table kader_status (
  id            uuid primary key default gen_random_uuid(),
  halbserie_id  uuid not null references halbserien (id) on delete cascade,
  spieler_id    uuid not null references spieler (id) on delete cascade,
  status        kader_status_typ not null default 'aktiv',
  pausiert_bis  date,
  notiz         text,
  geaendert_von uuid references benutzer (id) on delete set null,
  geaendert_am  timestamptz not null default now(),
  unique (halbserie_id, spieler_id)
);

-- -----------------------------------------------------------------------------
-- spiele
-- -----------------------------------------------------------------------------
create table spiele (
  id                   uuid primary key default gen_random_uuid(),
  halbserie_id         uuid not null references halbserien (id) on delete cascade,
  mannschaft_id        uuid not null references mannschaften (id) on delete cascade,
  spieltag_nr          int not null,
  datum                date not null,
  uhrzeit              time,
  heim                 boolean not null default true,
  gegner               text not null,
  gegner_kontakt_email text,
  ort                  text,
  status               spiel_status not null default 'geplant',
  verlegt_von          date
);

-- -----------------------------------------------------------------------------
-- verfuegbarkeiten — der Kern der Matrix
-- -----------------------------------------------------------------------------
create table verfuegbarkeiten (
  id              uuid primary key default gen_random_uuid(),
  spiel_id        uuid not null references spiele (id) on delete cascade,
  spieler_id      uuid not null references spieler (id) on delete cascade,
  status          verfuegbarkeit_status not null default 'nicht_angefragt',
  kommentar       text,
  quelle          quelle_typ not null default 'system',
  erinnert_count  int not null default 0,
  eingetragen_von uuid references benutzer (id) on delete set null,
  updated_at      timestamptz not null default now(),
  unique (spiel_id, spieler_id)
);

create trigger verfuegbarkeiten_updated_at
  before update on verfuegbarkeiten
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- abwesenheiten
-- -----------------------------------------------------------------------------
create table abwesenheiten (
  id         uuid primary key default gen_random_uuid(),
  spieler_id uuid not null references spieler (id) on delete cascade,
  von        date not null,
  bis        date not null,
  grund      text,
  quelle     quelle_typ not null default 'webapp',
  check (bis >= von)
);

-- -----------------------------------------------------------------------------
-- ersatzanfragen — Zustandsautomat mit Lock
-- -----------------------------------------------------------------------------
create table ersatzanfragen (
  id                 uuid primary key default gen_random_uuid(),
  spiel_id           uuid not null references spiele (id) on delete cascade,
  spieler_id         uuid not null references spieler (id) on delete cascade,
  spiel_datum        date not null,  -- denormalisiert für den Lock-Constraint
  rang               int not null default 0,
  status             anfrage_status not null default 'vorgeschlagen',
  begruendung        jsonb not null default '{}'::jsonb,
  freigegeben_von    uuid references benutzer (id) on delete set null,
  freigegeben_am     timestamptz,
  gesendet_am        timestamptz,
  frist_bis          timestamptz,
  beantwortet_am     timestamptz,
  antwort_kommentar  text
);

-- Ersatz-Lock (SPEC A.4): pro Spieler und Kalendertag max. eine offene Anfrage
-- in Bearbeitung. DB-Constraint, kein Anwendungscode.
create unique index ersatz_lock
  on ersatzanfragen (spieler_id, spiel_datum)
  where status in ('freigegeben', 'gesendet');

-- -----------------------------------------------------------------------------
-- einsaetze — Basis für Festspiel-Prüfung
-- -----------------------------------------------------------------------------
create table einsaetze (
  id            uuid primary key default gen_random_uuid(),
  halbserie_id  uuid not null references halbserien (id) on delete cascade,
  spieler_id    uuid not null references spieler (id) on delete cascade,
  mannschaft_id uuid not null references mannschaften (id) on delete cascade,
  spiel_id      uuid references spiele (id) on delete set null,
  datum         date not null,
  ersatz        boolean not null default false,
  quelle        quelle_typ not null default 'system'
);

-- -----------------------------------------------------------------------------
-- regel_config — pro Mannschaft, pro Halbserie
-- -----------------------------------------------------------------------------
create table regel_config (
  mannschaft_id uuid not null references mannschaften (id) on delete cascade,
  halbserie_id  uuid not null references halbserien (id) on delete cascade,
  config        jsonb not null default '{}'::jsonb,
  primary key (mannschaft_id, halbserie_id)
);

-- -----------------------------------------------------------------------------
-- verlegungen (Phase 2/3)
-- -----------------------------------------------------------------------------
create table verlegungen (
  id                uuid primary key default gen_random_uuid(),
  spiel_id          uuid not null references spiele (id) on delete cascade,
  status            text not null default 'entwurf',  -- entwurf|freigegeben|gesendet|zugesagt|abgelehnt
  terminvorschlaege date[] not null default array[]::date[],
  mail_entwurf      text,
  mail_final        text,
  gesendet_am       timestamptz,
  antwort_am        timestamptz
);

-- -----------------------------------------------------------------------------
-- nachrichten — Kommunikations-Log
-- -----------------------------------------------------------------------------
create table nachrichten (
  id                  uuid primary key default gen_random_uuid(),
  spieler_id          uuid not null references spieler (id) on delete cascade,
  spiel_id            uuid references spiele (id) on delete set null,
  ersatzanfrage_id    uuid references ersatzanfragen (id) on delete set null,
  richtung            text not null,  -- ausgehend|eingehend
  kanal               kanal_typ not null,
  typ                 text not null,  -- abfrage|reminder|ersatzanfrage|bestaetigung|eskalation
  inhalt              text not null,
  telegram_message_id bigint,
  created_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- audit_log
-- -----------------------------------------------------------------------------
create table audit_log (
  id          bigserial primary key,
  benutzer_id uuid references benutzer (id) on delete set null,  -- null = System/Bot
  aktion      text not null,
  entitaet    text not null,
  entitaet_id uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indizes auf häufige Fremdschlüssel-Zugriffe
-- -----------------------------------------------------------------------------
create index idx_spiele_halbserie      on spiele (halbserie_id);
create index idx_spiele_mannschaft     on spiele (mannschaft_id);
create index idx_spiele_datum          on spiele (datum);
create index idx_verf_spiel            on verfuegbarkeiten (spiel_id);
create index idx_verf_spieler          on verfuegbarkeiten (spieler_id);
create index idx_meldungen_mannschaft  on meldungen (mannschaft_id);
create index idx_kaderstatus_spieler   on kader_status (spieler_id);
create index idx_ersatz_spiel          on ersatzanfragen (spiel_id);
create index idx_einsaetze_spieler     on einsaetze (spieler_id);
create index idx_nachrichten_spieler   on nachrichten (spieler_id);
create index idx_abwesenheiten_spieler on abwesenheiten (spieler_id);
