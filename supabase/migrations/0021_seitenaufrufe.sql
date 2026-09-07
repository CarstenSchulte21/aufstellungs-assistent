-- =============================================================================
-- Aufstellungs-Assistent · Migration 0021 — Anonyme Seitenaufrufe (Statistik)
--
-- Datensparsame Nutzungsstatistik: je Seitenaufruf EIN Datensatz mit
-- normalisiertem Pfad und (aggregierter) Rolle — bewusst OHNE Benutzer-Bezug,
-- damit sich daraus keine Einzelperson nachverfolgen lässt. Dient nur dem
-- Admin-Dashboard (welche Bereiche werden genutzt). Keine Dritt-Dienste.
-- =============================================================================

create table if not exists seitenaufrufe (
  id         bigserial primary key,
  pfad       text not null,     -- normalisiert, z. B. /spieltag/[id]
  rolle      text,              -- spieler | mf | admin (aggregiert, nicht personenbezogen)
  created_at timestamptz not null default now()
);

create index if not exists idx_seitenaufrufe_zeit on seitenaufrufe (created_at);
create index if not exists idx_seitenaufrufe_pfad on seitenaufrufe (pfad);

alter table seitenaufrufe enable row level security;

-- Nur Admins dürfen die Statistik lesen. Geschrieben wird ausschließlich über
-- den Service-Role-Client (umgeht RLS) aus der Track-API — daher keine
-- Insert-Policy für normale Nutzer.
drop policy if exists admin_read on seitenaufrufe;
create policy admin_read on seitenaufrufe
  for select to authenticated
  using (app_is_admin());

-- Aggregation für das Dashboard (admin-geschützt über app_is_admin im WHERE).
create or replace function seiten_aufrufe_agg(seit timestamptz)
returns table(pfad text, rolle text, anzahl bigint)
language sql
security definer
set search_path = public
as $$
  select pfad, rolle, count(*)::bigint as anzahl
  from seitenaufrufe
  where created_at >= seit and app_is_admin()
  group by pfad, rolle
  order by count(*) desc
$$;

grant execute on function seiten_aufrufe_agg(timestamptz) to authenticated;
