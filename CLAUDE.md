# Projekt: Aufstellungs-Assistent (Tischtennis-Verein)

## Was gebaut wird
Ein vereinsweites Planungssystem für 6 Tischtennis-Mannschaften (~40 Spieler) im WTTV:
Spieltag-Verfügbarkeiten per Telegram-Bot abfragen, zentrale Saison-Matrix in einer Webapp,
regelbasierte Ersatzvorschläge mit Freigabe durch Mannschaftsführer, später Verlegungs-Mails.

## Maßgebliche Dokumente in diesem Repo
- `SPEC.md` — Datenmodell (Teil A) und Screen-Spezifikation Phase 1+2 (Teil B). **Bindend.**
- `prototyp/aufstellung-prototyp.jsx` — klickbarer UI-Prototyp; Referenz für Look & Feel
  der Saison-Matrix, des Spieltag-Details und der Kader-Ansicht.
- `MEILENSTEINE.md` — Reihenfolge der Umsetzung. Immer nur den aktuellen Meilenstein bauen.

Bei Widersprüchen oder Unklarheiten in der SPEC: **nachfragen, nicht selbst entscheiden.**

## Stack (festgelegt, nicht ändern)
- Next.js (App Router, TypeScript) — Webapp + API-Routen in einer Codebasis
- Supabase — PostgreSQL, Auth (Magic Link), Row Level Security, Realtime, pg_cron
- grammY — Telegram-Bot via Webhook (Next.js API-Route)
- Tailwind CSS — Styling, Farbwelt wie im Prototyp (#123c73 als Primärfarbe)
- Claude API — NUR für: Freitext-Antworten von Spielern klassifizieren,
  später Verlegungs-Mail-Entwürfe und PDF-Spielplan-Import
- Hosting: Vercel (automatisches Deployment aus main)

## Nicht verhandelbare Prinzipien
1. **Human-in-the-Loop:** Das System schlägt vor, Menschen entscheiden. Keine Nachricht an
   Ersatzkandidaten ohne Freigabe eines Mannschaftsführers. Keine automatischen Aufstellungen.
2. **Regel-Engine ist deterministischer Code**, niemals LLM-Aufrufe. Das LLM interpretiert
   keine WTTV-Regeln.
3. **Der Ersatz-Lock ist ein DB-Constraint** (Unique Index auf spieler_id + spiel_datum bei
   offenen Anfragen), kein Anwendungscode. Siehe SPEC.md A.4.
4. **Alles auditierbar:** Statusänderungen und Entscheidungen ins audit_log (Diff alt → neu).
5. **Zwei Wahrheiten getrennt halten:** offizielle Mannschaftsmeldung (formale Ebene) vs.
   operativer Kader-Status (Planungsebene). Siehe SPEC.md A.1.
6. Spielstärken: 1. Mannschaft = 6 Spieler (Bezirksoberliga), Mannschaften 2–6 = 4 Spieler.
   Immer gegen `mannschaften.spielstaerke` rechnen, nie hart codieren.

## Sprache & Ton
- Gesamte UI, Bot-Nachrichten, Fehlermeldungen: **Deutsch**, Du-Form, freundlich-knapp.
- Code, Kommentare, Commit-Messages: Englisch.
- Bot-Nachrichten kurz und mit Inline-Buttons ([✅ Ja] [❌ Nein] [🤔 Unsicher]) statt Freitext.

## Arbeitsweise mit dem Auftraggeber
- Der Auftraggeber ist Product Owner, kein Programmierer. Erkläre Ergebnisse und nötige
  Handgriffe (Keys eintragen, Webhook setzen) in einfachen Schritt-für-Schritt-Anleitungen.
- Nach jedem Meilenstein: kurz zusammenfassen, was gebaut wurde, was zu testen ist und
  welche manuellen Schritte anstehen.
- Kleine Commits mit klaren Messages; nach jedem Meilenstein ein Commit.
- Secrets (Supabase-Keys, Bot-Token, Claude-API-Key) nur in `.env.local` /
  Vercel-Umgebungsvariablen, niemals im Code oder Repo.

## Qualitätsfloor
- Responsive bis Smartphone-Breite (Spieler nutzen die Webapp primär mobil).
- RLS-Policies gemäß SPEC.md A.6 von Anfang an aktiv, nie „später nachrüsten".
- Zeitzone Europe/Berlin für alle Fristen und Scheduler-Jobs.
- Demo-/Seed-Daten klar als solche markiert und leicht entfernbar.
