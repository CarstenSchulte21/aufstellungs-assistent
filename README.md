# Aufstellungs-Assistent

Vereinsweites Planungssystem für unsere 6 Tischtennis-Mannschaften.
Siehe `CLAUDE.md` (Leitplanken), `SPEC.md` (Datenmodell & Screens) und
`MEILENSTEINE.md` (Umsetzungsreihenfolge).

**Stand: Meilenstein 1 — Projektgerüst & Datenbank.**

---

## Was in diesem Meilenstein gebaut wurde

- Next.js-Projekt (App Router, TypeScript, Tailwind) mit Supabase-Anbindung
  und einer schlichten Start-Seite, die als Verbindungstest die 6 Mannschaften
  aus der Datenbank anzeigt.
- Komplettes Datenbankschema aus `SPEC.md` Teil A als Supabase-Migrationen:
  alle Tabellen, Enums, Constraints, der **Ersatz-Lock-Index** und die
  **Row-Level-Security-Policies** aus A.6.
- Seed-Skript mit den 6 Mannschaften (1. Mannschaft als Sechser/Bezirksoberliga,
  2.–6. als Vierer), ~40 Demo-Spielern, Meldung, Kader-Status, einem
  Demo-Spielplan der Hinrunde und gestreuten Verfügbarkeiten.

Alle Migrationen und der Seed wurden gegen ein echtes PostgreSQL getestet:
Schema, Lock-Index, „genau eine aktive Halbserie" und RLS greifen wie erwartet.

---

## Einrichtung — Schritt für Schritt

Du brauchst dafür kein Programmierwissen. Halte deine drei Supabase-Schlüssel
aus Meilenstein 0 bereit (Project URL, anon key, service_role key).

### 1. Node.js installieren (einmalig)

Falls noch nicht vorhanden: [nodejs.org](https://nodejs.org) → Version „LTS"
herunterladen und installieren. Danach im Terminal prüfen:

```bash
node --version
```

### 2. Projektabhängigkeiten installieren

Terminal im Projektordner öffnen und einmalig ausführen:

```bash
npm install
```

### 3. Zugangsdaten eintragen

Kopiere die Vorlage `.env.local.example` zu `.env.local`:

```bash
cp .env.local.example .env.local
```

Öffne `.env.local` in einem Texteditor und trage deine Supabase-Werte ein
(Dashboard → Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://DEINPROJEKT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJ...    (service_role key — GEHEIM)
```

Diese Datei wird **nie** ins Repository hochgeladen (steht in `.gitignore`).

### 4. Datenbankschema einspielen

Am einfachsten über das Supabase-Dashboard, ganz ohne zusätzliche Tools:

1. Supabase-Dashboard öffnen → linkes Menü **SQL Editor** → **New query**.
2. Inhalt von `supabase/migrations/0001_schema.sql` komplett hineinkopieren,
   **Run** klicken. (Erstellt Tabellen, Enums, Lock-Index.)
3. Neues Query, Inhalt von `supabase/migrations/0002_rls.sql` einfügen,
   **Run**. (Aktiviert Row Level Security.)
4. Neues Query, Inhalt von `supabase/seed.sql` einfügen, **Run**.
   (Füllt Mannschaften, Demo-Spieler, Spielplan.)

> Reihenfolge unbedingt einhalten: erst 0001, dann 0002, dann seed.

### 5. Abnahme prüfen

Im Supabase-Dashboard → **Table Editor**: Es sind alle Tabellen sichtbar und
gefüllt — u. a. 6 Zeilen in `mannschaften`, ~40 in `spieler`, Einträge in
`spiele` und `verfuegbarkeiten`.

Optional lokal ansehen:

```bash
npm run dev
```

Dann [http://localhost:3000](http://localhost:3000) öffnen — die Start-Seite
meldet „Verbindung zu Supabase steht" und listet die 6 Mannschaften.

---

## Demo-Daten wieder entfernen

Wenn der echte Betrieb startet (Ende Phase 1): im SQL Editor den Inhalt von
`supabase/seed_teardown.sql` ausführen. Das löscht alle Demo-Spieler und den
Demo-Spielplan, **die 6 Mannschaften bleiben erhalten**.

---

## Projektstruktur

```
├─ CLAUDE.md, SPEC.md, MEILENSTEINE.md   Vorgaben & Plan
├─ prototyp/aufstellung-prototyp.jsx     UI-Referenz (Look & Feel)
├─ src/app/                              Next.js-Seiten
├─ src/lib/supabase/                     Supabase-Clients (Browser/Server)
└─ supabase/
   ├─ migrations/0001_schema.sql         Tabellen, Enums, Lock-Index
   ├─ migrations/0002_rls.sql            Row-Level-Security (A.6)
   ├─ seed.sql                           Demo-Daten
   └─ seed_teardown.sql                  Demo-Daten entfernen
```

---

## Offener Punkt für Meilenstein 2

Freitext-Spalten (`verfuegbarkeiten.kommentar`, `abwesenheiten.grund`,
`kader_status.notiz`) sind laut SPEC A.6 sensibel und sollen anderen Spielern
verborgen bleiben. RLS wirkt aber nur zeilen-, nicht spaltenweise. Diese
Spalten-Maskierung wird beim Bau der Saison-Matrix (S3) über eine gezielte
Datenbank-View umgesetzt. Der sensible Nachrichten-Store (`nachrichten`) ist
bereits jetzt vollständig abgeschottet.
