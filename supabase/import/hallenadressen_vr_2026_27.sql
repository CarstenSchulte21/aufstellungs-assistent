-- =============================================================================
-- Hallenadressen der Auswärts-Gegner · Vorrunde 2026/27 (Recherche, OHNE GEWÄHR)
--
-- Setzt spiele.ort für die Auswärtsspiele aller Mannschaften auf die Halle des
-- Gegners. Damit erscheint die Adresse im Spieltag-Detail und automatisch als
-- LOCATION in den Kalender-Einträgen (.ics).
--
-- Quelle: öffentliche Vereins-/Verbandsangaben. Die Hallen sind die Haupt-/
-- Trainingshallen der Vereine; das tatsächliche Spiellokal einzelner (Reserve-)
-- Mannschaften kann abweichen — daher „ohne Gewähr". Vor der Fahrt das
-- Spiellokal zum jeweiligen Termin gegenprüfen.
--
-- Idempotent: erneutes Ausführen setzt dieselben Werte. Matcht die aktive
-- Halbserie, Auswärtsspiele (heim = false) je Gegnername.
-- =============================================================================

do $$
declare
  v_hs uuid;
begin
  select id into v_hs from halbserien where aktiv limit 1;
  if v_hs is null then raise exception 'Keine aktive Halbserie gefunden.'; end if;

  -- Hilfs-Update: setzt ort für ein Auswärtsspiel anhand des Gegnernamens
  -- (per einfacher UPDATE-Anweisungen unten).

  -- 1. Mannschaft --------------------------------------------------------------
  update spiele set ort = 'Apostelgymnasium, Biggestraße 2, 50931 Köln'
    where halbserie_id = v_hs and heim = false and gegner = '1. FC Köln V';
  update spiele set ort = 'Theodor-Heuss-Sporthalle, Amselweg/Am Rotbach, 50374 Erftstadt-Lechenich'
    where halbserie_id = v_hs and heim = false and gegner = 'TTC BW Lechenich';
  update spiele set ort = 'Turnhalle Vogelsanger Markt, Vogelsanger Str. 453, 50829 Köln'
    where halbserie_id = v_hs and heim = false and gegner = 'TTG Vogelsang';
  update spiele set ort = 'GGS Geilenkircher Str. 52, 50933 Köln (Braunsfeld)'
    where halbserie_id = v_hs and heim = false and gegner = '1. TTC Köln';
  update spiele set ort = 'Turnhalle Jahnstraße 10a, 50126 Bergheim-Glesch'
    where halbserie_id = v_hs and heim = false and gegner = 'BC Vikt. Glesch/Paffendorf';

  -- 2. Mannschaft --------------------------------------------------------------
  update spiele set ort = 'Sporthalle Berzdorf, Emsstraße, 50389 Wesseling-Berzdorf'
    where halbserie_id = v_hs and heim = false and gegner = 'TTG Berzdorf';
  update spiele set ort = 'Apostelgymnasium, Biggestraße 2, 50931 Köln'
    where halbserie_id = v_hs and heim = false and gegner = '1. FC Köln VI';
  update spiele set ort = 'Mauritiusschule Ellernbende, 50226 Frechen-Bachem'
    where halbserie_id = v_hs and heim = false and gegner = 'TTC Bachem';
  update spiele set ort = 'Turnhalle Jahnstraße, 50259 Pulheim-Brauweiler'
    where halbserie_id = v_hs and heim = false and gegner = 'TTC GW Brauweiler II';

  -- 3. Mannschaft --------------------------------------------------------------
  update spiele set ort = 'Europaschule Kerpen (Dreifachhalle), Philipp-Schneider-Str., 50171 Kerpen'
    where halbserie_id = v_hs and heim = false and gegner = 'TTG Langenich II';
  update spiele set ort = 'GGS Geilenkircher Str. 52, 50933 Köln (Braunsfeld)'
    where halbserie_id = v_hs and heim = false and gegner = '1. TTC Köln III';
  update spiele set ort = 'Sport-/Turnhalle Heide, Grubenstraße 33, 50321 Brühl'
    where halbserie_id = v_hs and heim = false and gegner = 'TV Brühl';
  update spiele set ort = 'GGS im Süden, Godorfer Str. 29, 50997 Köln-Immendorf'
    where halbserie_id = v_hs and heim = false and gegner = 'TSV Immendorf';

  -- 4. Mannschaft --------------------------------------------------------------
  update spiele set ort = 'Gutenberg-Gymnasium, Gutenbergstraße 2a, 50126 Bergheim (Spiellokal prüfen)'
    where halbserie_id = v_hs and heim = false and gegner = 'TSV Kenten II';
  update spiele set ort = 'Mauritiusschule Ellernbende, 50226 Frechen-Bachem'
    where halbserie_id = v_hs and heim = false and gegner = 'TTC Bachem V';
  update spiele set ort = 'Turnhalle Jahnstraße, 50259 Pulheim-Brauweiler'
    where halbserie_id = v_hs and heim = false and gegner = 'TTC GW Brauweiler III';

  -- 5. Mannschaft --------------------------------------------------------------
  update spiele set ort = 'Mauritiusschule Ellernbende, 50226 Frechen-Bachem'
    where halbserie_id = v_hs and heim = false and gegner = 'TTC Bachem VI';
  update spiele set ort = 'Turnhalle Annastraße 63, 50968 Köln-Raderberg'
    where halbserie_id = v_hs and heim = false and gegner = 'SV Arminia Köln V';
  update spiele set ort = 'GGS im Süden, Godorfer Str. 29, 50997 Köln-Immendorf'
    where halbserie_id = v_hs and heim = false and gegner = 'TSV Immendorf IV';
  update spiele set ort = 'Turnhalle Auf dem Gallberg, 50321 Brühl-Badorf'
    where halbserie_id = v_hs and heim = false and gegner = 'TTC Pingsdorf/Badorf IV';
  update spiele set ort = 'Grundschule Am Tierpark, Herbergerstr. 5, 50127 Bergheim-Quadrath-Ichendorf'
    where halbserie_id = v_hs and heim = false and gegner = '1. FC Quadrath-Ichendorf II';
  update spiele set ort = 'Theodor-Heuss-Sporthalle, Amselweg/Am Rotbach, 50374 Erftstadt-Lechenich'
    where halbserie_id = v_hs and heim = false and gegner = 'TTC BW Lechenich IV';

  -- 6. Mannschaft --------------------------------------------------------------
  update spiele set ort = 'Dreifachturnhalle Hansaring / Ecke Adolf-Fischer-Str., 50670 Köln'
    where halbserie_id = v_hs and heim = false and gegner = 'TPS Köln III';
  update spiele set ort = 'GS Kopfbuche, Nordring 1 / Ecke Beethovenstraße, 50259 Pulheim (Spiellokal prüfen)'
    where halbserie_id = v_hs and heim = false and gegner = 'Pulheimer SC V';
  update spiele set ort = 'GS Stenzelbergstraße, 50939 Köln-Zollstock'
    where halbserie_id = v_hs and heim = false and gegner = 'SV RW Zollstock II';
  update spiele set ort = 'Edith-Stein-Realschule, Niehler Kirchweg 120a, 50733 Köln-Nippes'
    where halbserie_id = v_hs and heim = false and gegner = 'TFG Nippes VIII';
  update spiele set ort = 'Wilhelm-Leyendecker-Schule, Leyendeckerstraße 20-24, 50825 Köln'
    where halbserie_id = v_hs and heim = false and gegner = 'Roter Stern Köln';
end $$;
