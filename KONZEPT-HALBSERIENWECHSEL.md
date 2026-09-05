# Konzept: Halbserien-Wechsel

Stand: nach Abstimmung mit dem Auftraggeber. Ergänzung zu SPEC.md und
BACKLOG.md. Beschreibt den geführten Wechsel von einer Halbserie zur nächsten
(Hinrunde → Rückrunde, Saison → Saison).

## Getroffene Entscheidungen

1. **Übernahme:** Die neue Halbserie startet als **Kopie der Vorrunde**
   (Meldung, operativer Kader, Kader-Status, Regeln). Der Admin ändert nur die
   Abweichungen.
2. **Kein Entwurfsmodus:** Vorbereitet wird **am Saisonende in einem Rutsch**,
   nicht parallel zur laufenden Runde. Damit reicht die bestehende
   „aktive Halbserie"-Logik — die Vorbereitungs-Masken müssen keine fremde
   Ziel-Halbserie kennen.
3. **Umfang „Kern zuerst":** Neue Halbserie anlegen + Übernahme kopieren +
   Umschalten mit Kontrollübersicht. Spielplan und Meldungs-Feinschliff laufen
   über die bereits vorhandenen Admin-Masken.

## Datenmodell: was neu, was bleibt

**Pro Halbserie (wird beim Wechsel neu):** `meldungen` (Position, RES,
Sperrvermerk), `kader_zuordnung` (Stamm/Favorit), `kader_status`, `spiele`
(Spielplan), `regel_config` (Ersatz-Regeln je Mannschaft), `einsaetze`
(Einsatzzähler).

**Global (unverändert über den Wechsel):** `spieler` (Stammdaten, QTTR, E-Mail,
Kanal, Präferenzen, Proxy), `mannschaften` (Nummer, Name, Liga, Sollstärke,
Mannschaftsführer), `benutzer` (Konten, Rollen).

**Angenehme Automatiken:**

- Der **Einsatzzähler** startet von allein bei 0 — die neue Halbserie hat noch
  keine `einsaetze`-Zeilen. Kein Zurücksetzen nötig.
- **Abwesenheiten** hängen an Spieler + Datum (nicht an der Halbserie) und
  wirken automatisch weiter.

**Sonderfall Liga/Sollstärke:** liegen an der Mannschaft (global). Bei
Auf-/Abstieg werden sie beim Wechsel schlicht aktualisiert. Nebenwirkung: alte
Ansichten zeigen dann die neue Liga — verschmerzbar, da immer nur die aktive
Halbserie geplant wird.

## Ablauf (Kern zuerst)

Ein Assistent unter „Verwaltung → Neue Halbserie":

1. **Eingabe:** Bezeichnung (z. B. „Rückrunde 2026/27"), Start- und Enddatum.
2. **Vorschau:** Zeigt, was aus der aktuellen Halbserie kopiert wird
   (Anzahl Meldungen, Kader-Einträge, Regeln je Mannschaft).
3. **Anlegen + Kopieren + Umschalten** in einer Transaktion:
   - neue `halbserie` (inaktiv) anlegen,
   - `meldungen`, `kader_zuordnung`, `kader_status`, `regel_config` von der
     bisher aktiven Halbserie in die neue kopieren,
   - offene Abfragen/Ersatzanfragen der alten Runde als abgeschlossen markieren,
   - alte Halbserie `aktiv = false`, neue `aktiv = true`
     (die DB-Regel „genau eine aktive" wird eingehalten, weil erst die alte
     deaktiviert wird).
   - `spiele` werden **nicht** kopiert (neuer Spielplan).
4. **Kontrollübersicht danach:** kopierte Spieler/Kader/Regeln je Mannschaft,
   Hinweis „0 Spiele — bitte Spielplan erfassen", plus optionaler Auf-/Abstieg
   (Liga/Sollstärke je Mannschaft anpassen).
5. **Spielplan erfassen** über die bestehende Spielplan-Maske (zeigt nun auf die
   neue aktive Halbserie). Meldungs-Feinschliff über die Stammdaten-Maske.

## Technische Bausteine

- **Migration:** SQL-Funktion `halbserie_anlegen_aus_aktueller(bezeichnung,
  start, ende)` (SECURITY DEFINER, admin-geschützt): legt an, kopiert, schließt
  offene Vorgänge, schaltet um — alles in einer Transaktion. Gibt die neue
  `halbserie_id` und Kennzahlen zurück.
- **Admin-UI:** Neue Seite `admin/halbserie` mit Formular + Vorschau +
  Bestätigung („Ab jetzt ist die neue Runde aktiv"). Erreichbar aus dem
  Admin-Hub.
- **Guards:** nur Admin; explizite Bestätigung, weil das Umschalten den ganzen
  Verein betrifft; Eintrag ins `audit_log`.

## Bewusst später (nicht im ersten Bau)

- Entwurfsmodus: neue Runde vorbereiten, während die alte noch läuft.
- click-TT-/PDF-Import für Meldung und Spielplan (automatisches click-TT-Parsen
  ist laut deren Bedingungen nicht erlaubt; manuelle Eingabe bleibt der Weg).
- Geführte Meldungs- und Spielplan-Erfassung im Wizard (Copy-Paste-/CSV-Hilfe).
- Eigene UI für Sollstärke/Liga je Mannschaft (aktuell im Kontrollschritt
  mitbearbeitbar).
