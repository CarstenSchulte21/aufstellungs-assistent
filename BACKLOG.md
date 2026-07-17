# Backlog & Konzept-Notizen

Gesammelte Ideen und offene Konzepte für spätere Meilensteine. (Gepflegt
gemeinsam mit dem Auftraggeber; keine bindende Spezifikation — Ergänzung zu
SPEC.md und MEILENSTEINE.md.)

## Spielzeiten- / Halbserien-Konzept (wichtig)

Der Assistent muss **jede Halbserie neu planen** — nicht nur einmal pro Saison.
Zwischen Vor- und Rückrunde bzw. zwischen Saisons ändert sich vieles:

- Spieler wechseln den Verein (kommen/gehen), neue Spieler kommen dazu.
- Auf-/Abstieg → Mannschaften spielen in anderen Ligen, andere Sollstärke möglich.
- Neue Gegner, neuer Spielplan.
- Meldung (Positionen, Sperrvermerk, RES) wird pro Halbserie neu erstellt.
- Einsatz-/Festspiel-Zähler starten pro Halbserie neu.

**Zu bauen:** Ein geführter Ablauf „Neue Halbserie anlegen" (Admin):
1. Neue `halbserie` anlegen (Bezeichnung, Zeitraum) und aktiv schalten.
2. Meldung übernehmen/neu importieren (siehe click-TT-Import).
3. Spielplan importieren (siehe click-TT-Import).
4. Kader-Status initialisieren, Einsatzzähler auf 0.
Datenmodell trägt das bereits (`halbserien` + überall `halbserie_id`); es fehlt
der Workflow/die Oberfläche.

## click-TT-Import über die Oberfläche (für alle künftigen Spielzeiten)

Aktuell werden Spielplan und Meldung per einmaligem SQL-Skript importiert
(`supabase/import/…`). Ziel: Ein **Import-Knopf direkt in der Verwaltung**:
- Spielplan-Import: click-TT-Link einfügen → Spiele (Vor-/Rückrunde) übernehmen,
  Vorschau, bestätigen. Ersetzt/aktualisiert die Spiele der Mannschaft.
- Meldungs-Import: Vereins-Meldungslink einfügen → Spieler + Positionen +
  RES/Sperrvermerk übernehmen, Vorschau, bestätigen.
- Wiederholbar pro Halbserie, mit Duplikat-Abgleich (bestehende Spieler per
  Name/QTTR zuordnen statt doppelt anlegen).

## Mannschaftsführer-Rollen & dedizierte MF-Sichten

- **Admin weist MF zu:** Oberfläche, mit der der Admin einzelne Spieler als
  Mannschaftsführer bzw. stellvertretenden MF einer Mannschaft bestimmt
  (mehrere pro Team möglich). Datenmodell trägt das schon:
  `benutzer.rollen` enthält `mannschaftsfuehrer`, `benutzer.mf_von_mannschaften`
  ist ein uuid[] der zugeordneten Mannschaften (Co-MF möglich). Es fehlt die
  Admin-UI (aktuell nur per SQL).
- **Dedizierte MF-Sicht:** Eigene Ansicht, die nur die eigene(n) Mannschaft(en)
  zeigt — Spielplan, Kader und (ab Phase 2) Ersatzvorschläge/Inbox auf das eigene
  Team gefiltert. Die vorhandenen Screens (Kader S2, Spieltag S4) filtern bereits
  über `mfTeams`; nötig ist ein MF-Einstieg/Dashboard und ggf. ein auf das Team
  reduzierter Spielplan.

## Mannschafts-Sollstärke durch MF anpassbar

`mannschaften.spielstaerke` (Sechser/Vierer) soll der Mannschaftsführer künftig
selbst umstellen können (aktuell nur direkt in der DB). Sinnvoll gekoppelt an den
Halbserien-Wechsel (Auf-/Abstieg).

## Betrieb / Sonstiges

- Eigener Mail-Dienst (SMTP) in Supabase, bevor viele echte Spieler dazukommen
  (das eingebaute Mail-Limit reicht nicht).
- Kopplungs-API zeigt derzeit rohe DB-Fehlermeldungen (Debug) — bei Gelegenheit
  wieder aufräumen.

## Ideen-Sammlung (Auftraggeber, bewertet)

1. **Willkommens-/Info-Seite je Rolle** — beim ersten Login rollenabhängig
   (Admin/MF/Spieler) die Funktionen kurz erklären; danach dauerhaft als
   Info-Seite erreichbar. Dort auch Datenschutzhinweise. → *Wert: hoch
   (Adoption), Aufwand: mittel.* Gut mit Punkt 2 zu bündeln.
2. **Navigation aufräumen / je Rolle bündeln** — die Kopfzeile wird voll
   (Meine Spieltage, Meine Mannschaft, Kader, Regeln, Kopplung, Verwaltung).
   Nach Rolle gruppieren (z. B. Menü). → *Wert: hoch, Aufwand: mittel.*
3. **Startseite als Vereins-Übersicht** statt prominent 1. Mannschaft: je
   Mannschaft die wichtigsten Infos je Spieltag (zugesagt/abgesagt/offen,
   Lücken). → *Wert: hoch.* Deckt sich mit **M6 / S10 (Lagebild)** — dort
   umsetzen und zur neuen Startseite machen.
4. **Ersatz: finale Einplanung bestätigen** — nach „Fest einplanen" bekommt
   der Spieler aktuell keine Nachricht mehr. Beim Einplanen eine klare
   Telegram-/App-Nachricht „Du bist für Spieltag X fest eingeplant — bitte
   komm!". → *Wert: hoch, Aufwand: klein.* Quick Win.
5. **Spieltag-Reminder je Mannschaft** — Treffpunkt-Zeiten, vom MF anpassbar,
   Versand ca. 3 Tage vor dem Spiel an die zugesagten Spieler.
   Standard: Heim = 1 h vor Spielbeginn in der Halle; Auswärts = 1 h 15 vorher
   an der Halle. → *Wert: hoch (Praxis), Aufwand: mittel* (Config-Feld je
   Mannschaft + Scheduler + Nachricht).
6. **Fahrbereitschaft/Fahrgemeinschaften** (optional, später) — „Wer fährt mit
   Auto?", mehrere Fahrer möglich. → *Wert: nice-to-have, Aufwand: mittel.*
   Bewusst als Zusatzfunktion nach hinten.
7. **Doppelanfragen / MF-Abstimmung** — wenn zwei Mannschaften denselben
   Spieler (an unterschiedlichen Tagen/parallel) wollen, entscheiden die MF,
   nicht der Spieler. Der Tages-Lock verhindert schon zwei gleichzeitige offene
   Anfragen (der zweite MF sieht 🔒). Zusätzlich: den Konflikt in der
   **MF-Inbox (M6/S11)** sichtbar machen; ggf. anzeigen, welche Mannschaft
   angefragt hat. → *Wert: hoch, mit M6 verzahnen.*
8. **Ersatz-Filter nicht kategorisch bei Parallelspiel** — heute werden alle
   Spieler ausgeschlossen, deren Mannschaft am selben Tag spielt. Besser:
   maßgeblich ist die **Zusage**. Hat der Spieler bei seiner eigenen (oder einer
   anderen) Mannschaft **noch nicht** zugesagt, darf er angefragt werden. Hat er
   schon irgendwo zugesagt, wird das als **Status** in der Kandidatenliste
   angezeigt; im Zweifel einigen sich die MF. → *Wert: hoch (Korrektheit der
   Engine), Aufwand: klein–mittel.* Ändert `belegtAmTag`-Logik + Annotationen.

## Bereits in MEILENSTEINE.md geplant (Phase 2/3)

- M5 Regel-Engine & Ersatzvorschläge, M6 Lagebild & Inbox.
- Phase 3: Verlegungs-Mails mit Versand, PDF-Spielplan-Import, Statistiken.
