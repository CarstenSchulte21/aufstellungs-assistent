# Meilenstein-Plan · Aufstellungs-Assistent

Jeder Meilenstein = eine Claude-Code-Session (1–2 Stunden inkl. deinem Testen).
Die Aufträge in den Kästen kannst du wörtlich in Claude Code einfügen.
Nach jedem Meilenstein: selbst testen, Feedback geben, erst dann weiter.

---

## Meilenstein 0 — Vorbereitung (ohne Claude Code, ~1 Stunde)

Checkliste, einmalig:
- [ ] GitHub-Account + neues privates Repository `aufstellungs-assistent`
- [ ] Claude Code Desktop installieren, Repo als Projektordner öffnen
- [ ] Diese Dateien in den Projektordner legen:
      `CLAUDE.md` (Wurzel), `SPEC.md` (= aufstellung-datenmodell-screens.md, umbenennen),
      `MEILENSTEINE.md`, `prototyp/aufstellung-prototyp.jsx`
- [ ] Supabase-Account, neues Projekt „aufstellung" (Region: Frankfurt/eu-central),
      notieren: Project URL, anon key, service_role key
- [ ] Vercel-Account, mit GitHub verbinden (Import des Repos kommt in M1)
- [ ] Telegram: @BotFather anschreiben → /newbot → Namen vergeben → Token notieren
- [ ] Claude-API-Key unter console.anthropic.com anlegen (wird erst ab M4 gebraucht)

---

## Meilenstein 1 — Projektgerüst & Datenbank

> **Auftrag an Claude Code:**
> Lies CLAUDE.md und SPEC.md. Setze ein Next.js-Projekt (App Router, TypeScript,
> Tailwind) auf und implementiere das komplette Datenbankschema aus SPEC.md Teil A
> als Supabase-Migrationen: alle Tabellen, Enums, den Ersatz-Lock-Index und die
> RLS-Policies aus A.6. Erstelle ein Seed-Skript mit unseren 6 Mannschaften
> (1. Mannschaft Sechser/Bezirksoberliga, Rest Vierer) und ~40 Demo-Spielern plus
> Demo-Spielplan Hinrunde. Erkläre mir danach Schritt für Schritt, wie ich die
> Migration in mein Supabase-Projekt einspiele und die Keys in .env.local eintrage.

**Deine Abnahme:** Im Supabase-Dashboard (Table Editor) sind alle Tabellen sichtbar
und mit Demo-Daten gefüllt.

---

## Meilenstein 2 — Login & Saison-Matrix (Screens S1 + S3)

> **Auftrag an Claude Code:**
> Baue Screen S1 (Magic-Link-Login mit DSGVO-Einwilligung beim ersten Login) und
> Screen S3 (Saison-Matrix) gemäß SPEC.md Teil B, gegen die echte Supabase-DB.
> Orientiere dich optisch am Prototyp in prototyp/aufstellung-prototyp.jsx.
> Rollen aus der benutzer-Tabelle berücksichtigen. Richte danach mit mir zusammen
> das Vercel-Deployment ein.

**Deine Abnahme:** Du loggst dich per Mail-Link ein und siehst die Matrix aller
6 Mannschaften mit Demo-Daten — auch auf dem Handy.

---

## Meilenstein 3 — Telegram-Bot: Kopplung & Abfragen

> **Auftrag an Claude Code:**
> Implementiere den Telegram-Bot (grammY, Webhook als Next.js-API-Route) gemäß
> SPEC.md Teil B Abschnitt „Telegram-Bot": /start-Kopplung per Deeplink-Token,
> Verfügbarkeits-Abfrage mit Inline-Buttons, Bestätigung nach Antwort, Schreiben
> in die verfuegbarkeiten-Tabelle inkl. audit_log. Dazu die Scheduler-Jobs
> „Erstabfrage" und „Reminder" aus SPEC.md A.7. Erkläre mir, wie ich den Webhook
> mit meinem Bot-Token setze und wie ich mich selbst als ersten Spieler kopple.

**Deine Abnahme:** Du bekommst als Test-Spieler eine Abfrage in Telegram, tippst
[✅ Ja] — und siehst den grünen Haken sekundenschnell in der Matrix.

---

## Meilenstein 4 — Spieler-Sicht & Kaderpflege (Screens S5 + S2 + S4 Basis)

> **Auftrag an Claude Code:**
> Baue Screen S5 (Meine Spieltage inkl. Abwesenheiten und Proxy-Umschalter),
> Screen S2 (Kader kuratieren mit Status-Konsequenz-Dialogen) und das
> Spieltag-Detail S4 im Phase-1-Umfang gemäß SPEC.md. Abwesenheiten müssen
> Verfügbarkeiten automatisch setzen (A.4). Freitext-Antworten im Bot ab jetzt
> per Claude API klassifizieren, mit Rückbestätigung durch den Spieler.

**Deine Abnahme:** Abwesenheit „05.–19.10." anlegen → betroffene Spieltage stehen
auf Absage. Spieler pausieren → Warn-Dialog erscheint, Matrix aktualisiert sich.

➡ **Ende Phase 1.** Ab hier kann der echte Betrieb mit echten Spielern starten:
Demo-Daten raus, echte Spieler und Spielpläne rein (Screens S6/S7 nutzt du dafür —
falls noch Lücken, als Zwischenauftrag ergänzen).

---

## Meilenstein 5 — Regel-Engine & Ersatzvorschläge (Screens S8 + S9)

> **Auftrag an Claude Code:**
> Implementiere die Regel-Engine als reine, testbare Funktionen (kein LLM):
> Kandidatenermittlung nach regel_config, harte Filter (Zulässigkeit, Parallelspiel,
> Lock, Abwesenheit), weiche Annotationen (Festspiel-Zähler aus einsaetze,
> Präferenzen). Dazu Screen S8 (Vorschläge + Freigabe-Flow + Ersatzanfrage per Bot
> mit Frist) und S9 (Regelkonfiguration mit Live-Vorschau). Schreibe Unit-Tests
> für die Festspiel- und Lock-Logik mit den Testfällen, die ich dir gebe.

**Deine Abnahme (wichtigster Test des Projekts):** Du definierst 5–6 konkrete
Testfälle aus der WTTV-Praxis („Spieler mit 2 Ersatzeinsätzen wird vorgeschlagen →
Warnung?", „zwei MF fragen denselben Spieler an → zweiter sieht Lock?") und
spielst sie durch. Vorher: aktuelle WTTV-WO-Regeln gemeinsam mit Claude Code
verifizieren, nicht aus dem Gedächtnis.

---

## Meilenstein 6 — Lagebild & Inbox (Screens S10 + S11 + S12)

> **Auftrag an Claude Code:**
> Baue den Vereinskalender mit Konfliktliste (S10), die MF-Inbox für offene
> Entscheidungen mit Badge und täglicher Telegram-Zusammenfassung (S11) und die
> Einsatz-/Festspiel-Übersicht (S12) gemäß SPEC.md.

➡ **Ende Phase 2.** Danach (Phase 3, bei Bedarf): Verlegungs-Mails mit Versand,
PDF-Spielplan-Import, Statistiken.

---

## Merkzettel für jede Session

1. Session mit „Lies CLAUDE.md. Wir sind bei Meilenstein X." beginnen.
2. Einen Meilenstein pro Session — Zusatzwünsche notieren, nicht reinquetschen.
3. Nach der Umsetzung immer selbst klicken/testen, erst dann abnehmen.
4. Feedback in normalem Deutsch geben („Button zu klein", „hier fehlt der Gegner").
5. Am Ende der Session: committen lassen und kurz zusammenfassen lassen, was offen ist.
