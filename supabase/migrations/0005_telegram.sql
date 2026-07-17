-- =============================================================================
-- Aufstellungs-Assistent · Migration 0005 — Telegram-Kopplung
--
-- Für Meilenstein 3: Kopplung von Telegram-Account und Spieler per Deeplink.
-- Der Spieler öffnet in der Webapp einen persönlichen Link
--   https://t.me/<bot>?start=<token>
-- und der Bot verknüpft beim /start seine telegram_chat_id mit dem Spieler.
--
-- Hinweis: Die Token-Tabelle ist ein Implementierungsdetail der Kopplung
-- (in SPEC A.4 nicht explizit gelistet, aber technisch nötig für den
-- Deeplink-Flow aus Teil B „Telegram-Bot").
-- =============================================================================

create table telegram_koppel_tokens (
  token         uuid primary key default gen_random_uuid(),
  spieler_id    uuid not null references spieler (id) on delete cascade,
  erstellt_am   timestamptz not null default now(),
  eingeloest_am timestamptz
);

create index idx_koppel_spieler on telegram_koppel_tokens (spieler_id);

-- Ein Telegram-Chat gehört zu genau einem Spieler.
create unique index spieler_telegram_chat_unique
  on spieler (telegram_chat_id)
  where telegram_chat_id is not null;

-- RLS: Tokens erzeugen/sehen dürfen nur MF und Admin (der Bot nutzt den
-- service_role-Key und umgeht RLS ohnehin).
alter table telegram_koppel_tokens enable row level security;

create policy koppel_mf_admin on telegram_koppel_tokens
  for all to authenticated
  using (app_is_admin() or app_is_mf())
  with check (app_is_admin() or app_is_mf());

grant select, insert, update, delete on telegram_koppel_tokens to authenticated;
