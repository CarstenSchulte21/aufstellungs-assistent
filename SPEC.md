# Aufstellungs-Assistent · Datenmodell & Screens (Phase 1 + 2)

Stand: 16.07.2026 · Basis: Konzeptgespräch (vereinsweit, 6 Mannschaften, ~40 Spieler, Human-in-the-Loop, Telegram als Startkanal, Supabase/PostgreSQL)

---

## Teil A — Datenmodell

### A.1 Grundprinzipien

1. **Zwei Wahrheiten, sauber getrennt:** Die *offizielle Mannschaftsmeldung* (`meldungen`) ist die formale Grundlage für die Regel-Engine (Positionen, Sperrvermerke, Festspielen). Der *operative Kader* (`kader_status`) ist die Planungsrealität (aktiv/pausiert/inaktiv), die die Mannschaftsführer pflegen.
2. **Alles hat eine Historie:** Statuswechsel, Anfragen und Antworten werden nie überschrieben, sondern versioniert bzw. im Audit-Log festgehalten — das ist die technische Umsetzung der Transparenz-Anforderung.
3. **Der Lock ist ein Datenbank-Constraint, kein Anwendungscode:** Pro Spieler und Kalendertag darf es maximal eine offene Ersatzanfrage geben. Das wird auf DB-Ebene erzwungen, damit auch parallele Zugriffe zweier Mannschaftsführer nie kollidieren.
4. **Halbserien-Bezug überall:** Meldungen, Regelkonfiguration und Einsatzzählung hängen an der Halbserie, weil sich mit jeder Meldung Positionen und Festspiel-Zähler neu sortieren.
5. **Gemischte Spielstärken:** Die 1. Mannschaft spielt als Sechser (Bezirksoberliga), alle anderen als Vierer. Die Spielstärke ist deshalb ein Attribut der Mannschaft (`spielstaerke`), nicht des Systems — Lückenanalyse, Zähler und Vollständigkeits-Ampel rechnen überall gegen diesen Wert. Für die Regel-Engine relevant: Beim Ersatz aus einer Vierer- in die Sechser-Mannschaft (2. → 1.) und zwischen Vierer-Mannschaften gelten die Positions- und Festspielregeln des WTTV unverändert auf Basis der Meldung; die konkrete Prüf-Logik wird in Phase 2 gegen die aktuelle WO des WTTV verifiziert.

### A.2 Entitäten-Übersicht (ERD, vereinfacht)

```
halbserien ──┬── meldungen ──── spieler ──┬── kader_status
             │        │                   ├── abwesenheiten
             │   mannschaften ── regel_config
             │        │
             └──── spiele ──┬── verfuegbarkeiten ── spieler
                            ├── ersatzanfragen ──── spieler
                            ├── verlegungen
                            └── einsaetze ───────── spieler

benutzer (auth) ── spieler          nachrichten ── spieler / spiele
audit_log (referenziert alle Entitäten)
```

### A.3 Enums

| Enum | Werte |
|---|---|
| `kader_status_typ` | `aktiv`, `pausiert`, `inaktiv` |
| `kanal_typ` | `telegram`, `webapp`, `proxy`, `email` |
| `verfuegbarkeit_status` | `nicht_angefragt`, `angefragt`, `erinnert`, `zugesagt`, `unsicher`, `abgesagt`, `keine_antwort`, `extern_verplant` |
| `anfrage_status` | `vorgeschlagen`, `freigegeben`, `gesendet`, `zugesagt`, `abgelehnt`, `abgelaufen`, `zurueckgezogen`, `eingeplant` |
| `spiel_status` | `geplant`, `verlegung_angefragt`, `verlegt`, `gespielt`, `abgesetzt` |
| `rolle_typ` | `admin`, `mannschaftsfuehrer`, `spieler` |
| `quelle_typ` | `telegram_button`, `telegram_text`, `webapp`, `proxy`, `system`, `admin` |

`extern_verplant` deckt den Teilstart-/Randfall ab: Ein Spieler meldet selbst „an dem Tag anderweitig verplant" (z. B. Einsatz außerhalb des Systems) und wird für Vorschläge blockiert.

### A.4 Tabellen im Detail

#### `halbserien`
| Feld | Typ | Anmerkung |
|---|---|---|
| id | uuid PK | |
| bezeichnung | text | „Hinrunde 2026/27" |
| start / ende | date | |
| aktiv | bool | genau eine aktive Halbserie |

#### `spieler`
| Feld | Typ | Anmerkung |
|---|---|---|
| id | uuid PK | |
| name | text | |
| telefon / email | text, nullable | |
| telegram_chat_id | bigint, nullable | wird beim Bot-Onboarding per `/start`-Deeplink verknüpft |
| kanal | kanal_typ | bevorzugter Kommunikationsweg |
| proxy_spieler_id | uuid FK → spieler, nullable | wer stellvertretend einträgt (Edge Case „kein Smartphone") |
| qttr | int | manuell gepflegt, halbjährlich aktualisiert |
| praeferenzen | jsonb | siehe A.5 |
| dsgvo_einwilligung_am | timestamptz, nullable | ohne Einwilligung keine Bot-Nachrichten |
| created_at | timestamptz | |

#### `mannschaften`
| Feld | Typ | Anmerkung |
|---|---|---|
| id | uuid PK | |
| nummer | int | 1–6, bestimmt die Standard-Kaskadenrichtung |
| name / liga | text | |
| spielstaerke | int | benötigte Spieler: 6 bei der 1. Mannschaft (Bezirksoberliga), 4 bei allen anderen (Vierer-Mannschaften) |
| mannschaftsfuehrer_id | uuid FK → spieler | zweiter MF optional über Rollen (A.9) |

#### `meldungen` — offizielle Mannschaftsmeldung (formale Ebene)
| Feld | Typ | Anmerkung |
|---|---|---|
| id | uuid PK | |
| halbserie_id | uuid FK | |
| mannschaft_id | uuid FK | |
| spieler_id | uuid FK | |
| position | int | Position lt. Meldung |
| sperrvermerk | bool | |
| res | bool | RES-Kennzeichnung |

Unique: `(halbserie_id, spieler_id)`. Import per PDF-Upload mit Bestätigungs-Vorschau (Phase 3), bis dahin manuelle Erfassung im Admin-Bereich.

#### `kader_status` — operative Ebene
| Feld | Typ | Anmerkung |
|---|---|---|
| id | uuid PK | |
| halbserie_id / spieler_id | uuid FK | unique zusammen |
| status | kader_status_typ | |
| pausiert_bis | date, nullable | „voraussichtlich zurück ab" |
| notiz | text | „Knie-OP", „Karteileiche seit 2024" |
| geaendert_von / geaendert_am | uuid, timestamptz | |

Statuswechsel lösen Systemreaktionen aus: `pausiert`/`inaktiv` → offene Abfragen und Ersatzanfragen des Spielers werden zurückgezogen, betroffene Spiele wandern in die Lückenanalyse.

#### `spiele`
| Feld | Typ | Anmerkung |
|---|---|---|
| id | uuid PK | |
| halbserie_id / mannschaft_id | uuid FK | |
| spieltag_nr | int | |
| datum / uhrzeit | date, time | |
| heim | bool | |
| gegner | text | Vereinsname |
| gegner_kontakt_email | text, nullable | für Verlegungsanfragen |
| ort | text, nullable | |
| status | spiel_status | |
| verlegt_von | date, nullable | ursprünglicher Termin |

#### `verfuegbarkeiten` — der Kern der Matrix
| Feld | Typ | Anmerkung |
|---|---|---|
| id | uuid PK | |
| spiel_id / spieler_id | uuid FK | unique zusammen |
| status | verfuegbarkeit_status | |
| kommentar | text, nullable | Freitext des Spielers („Urlaub bis 20.09.") |
| quelle | quelle_typ | Telegram-Button, Webapp, Proxy … |
| erinnert_count | int default 0 | |
| eingetragen_von | uuid FK → benutzer, nullable | bei Proxy-Einträgen sichtbar |
| updated_at | timestamptz | |

Jede Statusänderung wird zusätzlich ins `audit_log` geschrieben (alter Wert → neuer Wert), damit die Historie („hatte erst zugesagt, dann abgesagt") nachvollziehbar bleibt.

#### `abwesenheiten`
| Feld | Typ | Anmerkung |
|---|---|---|
| id | uuid PK | |
| spieler_id | uuid FK | |
| von / bis | date | |
| grund | text, nullable | |
| quelle | quelle_typ | auch per Bot meldbar („bin im Oktober raus") |

Wirkung: Alle Spiele im Zeitraum werden automatisch auf `abgesagt` (Quelle: Abwesenheit) gesetzt; der Spieler taucht nicht in Ersatzvorschlägen auf.

#### `ersatzanfragen` — Zustandsautomat mit Lock
| Feld | Typ | Anmerkung |
|---|---|---|
| id | uuid PK | |
| spiel_id | uuid FK | das Spiel mit der Lücke |
| spieler_id | uuid FK | der Kandidat |
| spiel_datum | date | **denormalisiert** für den Lock-Constraint |
| rang | int | Position in der Kandidatenliste |
| status | anfrage_status | |
| begruendung | jsonb | Annotationen der Regel-Engine (Warnungen, Einsatzzähler) — wird dem MF angezeigt und archiviert |
| freigegeben_von / freigegeben_am | uuid, timestamptz | Human-in-the-Loop-Nachweis |
| gesendet_am / frist_bis | timestamptz | Antwortfrist (Standard 48 h, konfigurierbar) |
| beantwortet_am / antwort_kommentar | timestamptz, text | |

**Lock-Constraint:**
```sql
CREATE UNIQUE INDEX ersatz_lock
  ON ersatzanfragen (spieler_id, spiel_datum)
  WHERE status IN ('freigegeben', 'gesendet');
```
Damit kann derselbe Spieler pro Tag nur von einer Mannschaft „in Bearbeitung" sein — race-condition-frei, auch wenn zwei MF gleichzeitig klicken. Läuft die Frist ab, setzt der Scheduler auf `abgelaufen`, der Lock fällt, der nächste Kandidat rückt nach (als neuer Vorschlag, nicht automatisch gesendet).

Zustandsautomat:
```
vorgeschlagen ── MF gibt frei ──▶ freigegeben ── Bot sendet ──▶ gesendet
                                                              ├─ Spieler ✓ ─▶ zugesagt ─▶ eingeplant
                                                              ├─ Spieler ✕ ─▶ abgelehnt
                                                              └─ Frist um ──▶ abgelaufen
   (jederzeit durch MF: zurueckgezogen)
```

#### `einsaetze` — Basis für Festspiel-Prüfung
| Feld | Typ | Anmerkung |
|---|---|---|
| id | uuid PK | |
| halbserie_id / spieler_id / mannschaft_id | uuid FK | |
| spiel_id | uuid FK, nullable | null bei manuell nachgetragenen Alt-/Fremdeinsätzen |
| datum | date | |
| ersatz | bool | Einsatz in höherer Mannschaft? |
| quelle | quelle_typ | `system` oder `admin` (manuelle Nachpflege) |

Die Regel-Engine zählt hierüber Ersatzeinsätze pro Halbserie und warnt vor dem Festspielen. Manuelle Nachpflege deckt die Übergangszeit und Sonderfälle ab.

#### `regel_config` — pro Mannschaft, pro Halbserie
| Feld | Typ | Anmerkung |
|---|---|---|
| mannschaft_id / halbserie_id | uuid FK, PK zusammen | |
| config | jsonb | siehe unten |

```json
{
  "kaskade": ["M3", "M4"],
  "kaskade_sortierung": "position",
  "tabu_spieler": ["<spieler_id>"],
  "max_ersatzeinsaetze_pro_spieler": 2,
  "doppeleinsatz_erlauben": "nur_mit_zustimmung",
  "vorlauf_erstabfrage_tage": 28,
  "reminder_nach_stunden": 48,
  "max_reminder": 2,
  "ersatz_antwortfrist_stunden": 48
}
```
Jeder MF konfiguriert das selbst (Screen S9); sinnvolle Vereins-Defaults werden vom Admin vorbelegt.

#### `verlegungen` (Phase 2 Vorschau / Phase 3 voll)
| Feld | Typ | Anmerkung |
|---|---|---|
| id | uuid PK | |
| spiel_id | uuid FK | |
| status | text | `entwurf`, `freigegeben`, `gesendet`, `zugesagt`, `abgelehnt` |
| terminvorschlaege | date[] | aus freien Slots des eigenen Spielplans |
| mail_entwurf / mail_final | text | LLM-Entwurf vs. vom MF gesendete Fassung |
| gesendet_am / antwort_am | timestamptz | |

#### `nachrichten` — Kommunikations-Log
| Feld | Typ | Anmerkung |
|---|---|---|
| id | uuid PK | |
| spieler_id | uuid FK | |
| spiel_id / ersatzanfrage_id | uuid FK, nullable | Kontextbezug |
| richtung | text | `ausgehend` / `eingehend` |
| kanal | kanal_typ | |
| typ | text | `abfrage`, `reminder`, `ersatzanfrage`, `bestaetigung`, `eskalation` |
| inhalt | text | |
| telegram_message_id | bigint, nullable | für Button-Callbacks |
| created_at | timestamptz | |

#### `benutzer` (Supabase `auth.users` + Profil-Tabelle)
| Feld | Typ | Anmerkung |
|---|---|---|
| id | uuid PK = auth.users.id | Magic-Link-Login (E-Mail) |
| spieler_id | uuid FK, nullable | Admin kann auch Nicht-Spieler sein |
| rollen | rolle_typ[] | Mehrfachrollen: MF ist immer auch Spieler |
| mf_von_mannschaften | uuid[] | erlaubt Co-Mannschaftsführer |

#### `audit_log`
| Feld | Typ | Anmerkung |
|---|---|---|
| id | bigserial PK | |
| benutzer_id | uuid, nullable | null = System/Bot |
| aktion | text | `status_geaendert`, `anfrage_freigegeben`, … |
| entitaet / entitaet_id | text, uuid | |
| details | jsonb | Diff alt → neu |
| created_at | timestamptz | |

### A.5 Präferenz-Schema (`spieler.praeferenzen`)

```json
{
  "keine_doppeleinsaetze": true,
  "nur_heimspiele": false,
  "hilft_aus_bis_mannschaft": 2,
  "gesperrte_wochentage": ["Fr"],
  "hinweis": "Fragt mich gern, sagt aber oft erst kurzfristig zu"
}
```
Harte Kriterien (Zulässigkeit, Parallelspiel, Lock) *filtern* Kandidaten; Präferenzen *annotieren* nur — die Entscheidung bleibt beim MF.

### A.6 Zugriffsrechte (Row Level Security)

Transparenz war die explizite Anforderung, daher bewusst offen im Lesen:

| Rolle | Lesen | Schreiben |
|---|---|---|
| Spieler | alle Matrizen, Spielpläne, eigene Nachrichten | eigene Verfügbarkeiten & Abwesenheiten; als Proxy: die des verknüpften Spielers |
| Mannschaftsführer | alles | zusätzlich: Kader-Status, Verfügbarkeiten und Freigaben *seiner* Mannschaft(en), eigene `regel_config` |
| Admin | alles | alles inkl. Spielplan, Meldungen, Stammdaten |

Sensible Ausnahme: `nachrichten`-Inhalte und Freitext-Kommentare sieht nur der betroffene Spieler, sein MF und der Admin — die Matrix zeigt anderen nur den Status, nicht das „warum".

### A.7 Scheduler-Jobs (pg_cron / Edge Functions)

| Job | Rhythmus | Aufgabe |
|---|---|---|
| Erstabfrage | täglich | Spiele finden mit `datum - heute <= vorlauf` und Spielern ohne Abfrage → Bot-Nachricht, Status `angefragt` |
| Reminder | täglich | `angefragt` älter als `reminder_nach_stunden` → erinnern (max. `max_reminder`), danach `keine_antwort` + Eskalation an MF |
| Lock-Timeout | stündlich | `gesendet` mit `frist_bis < now()` → `abgelaufen`, MF benachrichtigen, nächsten Kandidaten vorschlagen |
| Abwesenheits-Sync | täglich | neue Abwesenheiten auf Verfügbarkeiten anwenden |

---

## Teil B — Screens

Navigationsstruktur (Webapp, responsive — Spieler nutzen sie primär mobil):

```
Login (Magic Link)
└─ Hauptnavigation (rollenabhängig eingeblendet)
   ├─ S3 Saison-Matrix ──▶ S4 Spieltag-Detail ──▶ (P2: S8 Ersatzvorschläge integriert)
   ├─ S5 Meine Spieltage (Spieler-Home)
   ├─ S2 Kader (MF)
   ├─ P2: S10 Vereinskalender & Konflikte
   ├─ P2: S11 Offene Anfragen (MF-Inbox)
   ├─ P2: S9 Regeln (MF) · P2: S12 Einsätze & Festspielen
   └─ S6/S7 Verwaltung (Admin)
```

### Phase 1 — Fundament

#### S1 · Login & Registrierung
Rolle: alle. Magic-Link per E-Mail; alternativ Kopplung via Telegram-Deeplink (`/start <token>`), der Bot- und Webapp-Identität verbindet. Erstes Login zeigt die DSGVO-Einwilligung (Zweck, Daten, Widerruf) als Pflicht-Checkbox; ohne Einwilligung keine Bot-Kommunikation, Webapp-Nutzung im Lesemodus möglich. Leerer Zustand: „Dein Mannschaftsführer hat dich noch nicht angelegt — sprich ihn an."

#### S2 · Kader kuratieren (MF) — das Onboarding
Rolle: MF, pro eigener Mannschaft. Liste aller lt. Meldung zugeordneten Spieler mit: Position, QTTR, Status-Umschalter (aktiv/pausiert/inaktiv, bei pausiert optional „zurück ab"), Kanal-Auswahl (Telegram/Webapp/Proxy inkl. Proxy-Personen-Zuordnung), Kontaktdaten, Präferenz-Editor (A.5), Notizfeld. Fortschrittsanzeige beim Erst-Onboarding („9 von 12 Spielern geprüft"). Aktion „Einladung senden" verschickt Magic-Link/Telegram-Link. Statuswechsel zeigen ihre Konsequenz als Bestätigungsdialog („3 offene Abfragen werden zurückgezogen, Spieltag 4 wird unvollständig — fortfahren?").

#### S3 · Saison-Matrix — der zentrale Screen
Rolle: alle (lesend), MF (handelnd). Aufbau wie im Prototyp: Mannschafts-Umschalter, Spieler × Spieltage, Statuschips (✓ ✕ ? ○ –), Spaltenkopf mit Datum, Gegner, Heim/Auswärts und Zähler `zugesagt/benötigt` mit Warnfarbe. Zusatz gegenüber Prototyp: Filter „nur Lücken zeigen", Hover/Tap auf Chip zeigt Historie (letzte Änderung, Quelle, Kommentar), Echtzeit-Updates via Supabase Realtime (zwei MF sehen Änderungen sofort). Proxy-Einträge tragen ein kleines Stellvertreter-Symbol. Leerer Zustand: „Noch kein Spielplan erfasst" mit Direktlink zu S6 (Admin) bzw. Hinweis für Nicht-Admins.

#### S4 · Spieltag-Detail (Phase-1-Umfang)
Rolle: alle (lesend), MF (handelnd). Kopf: Spieltag, Datum, Gegner, Heim/Auswärts, Zähler. Vier Statusgruppen (zugesagt / angefragt / abgesagt / keine Antwort) mit Personen-Badges und Kommentar-Vorschau. MF-Aktionen in Phase 1: einzelnen Spieler manuell erneut anfragen, Status manuell setzen (mit Quelle `proxy`/`admin`), Freitext-Notiz zum Spieltag. Hinweisbox bei Parallelspieltagen anderer Mannschaften (rein informativ in P1). Der Ersatzvorschlags-Block existiert schon als Platzhalter („verfügbar ab Phase 2"), damit die Erwartung gesetzt ist.

#### S5 · Meine Spieltage (Spieler-Home)
Rolle: Spieler (und Proxy-Vertreter mit Umschalter „Ich trage ein für: Horst"). Chronologische Liste der eigenen Spieltage mit Ein-Klick-Zu-/Absage (identisch zur Bot-Interaktion — wer den Bot nicht mag, nutzt nur diesen Screen). Abschnitt „Abwesenheiten": Zeitraum anlegen („05.–19.10., Urlaub"), Liste bestehender Einträge mit Löschen. Abschnitt „Ersatzanfragen an mich" (ab P2 aktiv). Kleine Hinweiszeile, welche Daten für den Verein sichtbar sind (Transparenz auch über die Transparenz).

#### S6 · Spielplan-Verwaltung (Admin)
Rolle: Admin. Tabelle aller Spiele aller Mannschaften mit Inline-Editing (Datum, Uhrzeit, Gegner, Heim/Auswärts), Filter pro Mannschaft, Massenanlage über Formular („8 Spieltage anlegen"). CSV-Import als einfache P1-Variante; PDF-Import mit LLM-Vorschau kommt in Phase 3, das UI (Upload → Vorschau-Tabelle → Bestätigen) ist dafür bereits vorgesehen. Terminänderung an bestehendem Spiel fragt: „Betroffene Spieler neu abfragen?" — und setzt bei Ja alle Verfügbarkeiten des Spiels zurück auf `angefragt`.

#### S7 · Stammdaten & Meldungen (Admin)
Rolle: Admin. Zwei Reiter: **Spielerstamm** (alle ~40 Spieler, Suche, Anlegen, Zusammenführen von Duplikaten, DSGVO-Status) und **Mannschaftsmeldung** (pro Halbserie und Mannschaft: Positionen, Sperrvermerk, RES — die formale Ebene). Halbserien-Wechsel („Rückrunde anlegen") kopiert Strukturen und setzt Einsatzzähler zurück.

### Phase 2 — Ersatzlogik

#### S8 · Ersatzvorschläge (Erweiterung von S4)
Rolle: MF. Bei Lücken erscheint pro fehlendem Platz die von der Regel-Engine sortierte Kandidatenliste: Name, Herkunftsmannschaft, Position, QTTR, Ersatzeinsatz-Zähler, Annotationen (⚠ Festspiel-Warnung, ⚠ Parallelspiel, Präferenzen) und Lock-Anzeige (🔒 „angefragt von 2. Mannschaft, Frist bis Do 18:00"). Aktionen: „Anfrage freigeben" (→ Bot sendet, Frist läuft), „überspringen mit Grund", „Kandidat manuell hinzufügen" (mit Regelprüfung und ggf. rotem Veto bei Unzulässigkeit — überstimmbar nur mit explizitem Bestätigen und Audit-Eintrag). Unterhalb: Eskalationsblock „Keine Aufstellung möglich" mit den Optionen *mit n Spielern antreten* (Dokumentation) und *Verlegung anstoßen* (P2: erzeugt Entwurfs-Datensatz; Mail-Versand kommt in P3, bis dahin Entwurf zum Kopieren).

#### S9 · Regelkonfiguration (MF)
Rolle: MF, pro eigener Mannschaft. Formular über `regel_config`: Kaskaden-Reihenfolge per Drag & Drop der Mannschaften, Sortierkriterium (Position/QTTR), Tabu-Spieler-Auswahl, Grenzwerte (max. Ersatzeinsätze pro Spieler, Doppeleinsatz-Politik), Zeitparameter (Vorlauf, Reminder, Antwortfristen). Live-Vorschau: „Für Spieltag 3 würde diese Konfiguration folgende Kandidaten ergeben: …" — das macht die abstrakten Regeln beim Einrichten sofort begreifbar. Vereins-Defaults sichtbar mit „zurücksetzen".

#### S10 · Vereinskalender & Konflikte
Rolle: alle (lesend). Wochen-/Monatsansicht aller Spiele aller sechs Mannschaften; Parallelspieltage optisch gebündelt. Konfliktliste darunter: Spieler mit Doppeleinsatz am selben Tag, Spieler mit Zusagen für zwei Mannschaften, Spieltage mit Lücken vereinsweit (sortiert nach Dringlichkeit = Tage bis zum Termin). Jeder Eintrag verlinkt in das jeweilige Spieltag-Detail. Dieser Screen ist das „Lagebild" für die MF-Runde und das beste Argument gegenüber skeptischen Mannschaftsführern.

#### S11 · Offene Anfragen (MF-Inbox)
Rolle: MF. Aufgabenorientierte Liste statt Matrix: alle Vorgänge, die *seine Entscheidung* brauchen — Kandidatenvorschläge zur Freigabe, abgelaufene Fristen mit Nachrück-Vorschlag, Eskalationen („2× erinnert, keine Antwort von Sven"), unsichere Zusagen zur Nachverfolgung, Zusagen von Ersatzspielern zur finalen Einplanung. Jede Karte mit Kontext und Ein-Klick-Aktion. Badge mit Anzahl in der Hauptnavigation. Optional als tägliche Telegram-Zusammenfassung an den MF gespiegelt („3 Entscheidungen offen").

#### S12 · Einsätze & Festspiel-Übersicht
Rolle: MF und Admin. Pro Spieler: Ersatzeinsätze der Halbserie (mit Datum und Mannschaft), Festspiel-Status als Ampel („noch 1 Einsatz frei"), Fairness-Sicht („wer wurde wie oft gefragt/eingesetzt" — verhindert, dass immer derselbe herhalten muss). Manuelle Nachpflege von Einsätzen (Quelle `admin`) für Übergangsfälle. Diese Daten speisen die Annotationen in S8.

### Telegram-Bot (Gegenstück zu den Screens, Phase 1)

Kein Screen, aber Teil der UX-Spezifikation: **Abfrage** mit Inline-Buttons [✅ Ja] [❌ Nein] [🤔 Unsicher], **Bestätigung** nach Antwort (inkl. Undo: „Doch anders? Einfach neu antworten"), **Reminder** (max. 2, dann Eskalation an MF), **Freitext-Verständnis** via LLM mit Rückbestätigung („Verstanden als Absage ✕ — korrekt?"), Kommandos `/spiele` (meine nächsten Termine), `/abwesend 05.10.-19.10.`, `/status`. In Phase 2 kommen Ersatzanfragen dazu (eigener Nachrichtentyp mit Kontext: „Die 2. Mannschaft braucht dich am Sa 12.09. …").

---

## Nächste Schritte

1. Feedback der fünf anderen Mannschaftsführer zum Prototyp einsammeln (insb. S3/S4-Verständlichkeit und Bereitschaft zur Kaderpflege)
2. Supabase-Projekt aufsetzen: Schema aus Teil A als Migration, RLS-Policies, Seed mit echten Mannschaften
3. Telegram-Bot registrieren (@BotFather), Webhook-Grundgerüst, `/start`-Kopplung
4. S3 + S5 + S2 als erste echte Screens gegen die DB bauen — damit ist der minimale Nutzenkreislauf (Abfrage → Antwort → Matrix) geschlossen
