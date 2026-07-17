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

---

# Meilenstein 2 — Login & Saison-Matrix

Neu gebaut: Anmeldung per E-Mail-Link (S1) mit DSGVO-Einwilligung beim ersten
Login und die Saison-Matrix (S3) gegen die echte Datenbank — Mannschafts-
Umschalter, Statuschips, Zähler „Zusagen/benötigt" mit Warnfarbe, Filter „nur
Lücken", Kommentar-Historie am Chip und Live-Aktualisierung.

## Einrichtung Meilenstein 2 — Schritt für Schritt

### 1. Neue Migrationen einspielen

Im Supabase **SQL Editor** nacheinander ausführen:

1. `supabase/migrations/0003_auth_profile.sql` → **Run**. (Legt das
   automatische Benutzerprofil beim Login an, die DSGVO-Funktion, die
   Kommentar-Maskierung und schaltet Live-Updates frei.)
2. `supabase/migrations/0004_grants.sql` → **Run**. (Gibt den Rollen die
   Grund-Berechtigung auf den Tabellen frei. Ohne diese zeigt die App trotz
   Login „keine Daten", weil die Zeilen-Regeln allein nicht ausreichen.)

### 2. Anmelde-Adressen in Supabase konfigurieren

Dashboard → **Authentication** → **URL Configuration**:

- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** `http://localhost:3000/**` hinzufügen

(Die Vercel-Adresse kommt später dazu, sobald deployt.)

### 3. App starten und anmelden

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) öffnen → du wirst zur Anmeldung
geleitet. E-Mail eintragen → du bekommst einen Link per Mail → anklicken →
du landest in der Saison-Matrix.

### 4. Dich selbst zum Admin/Mannschaftsführer machen (optional, empfohlen)

Nach deinem ersten Login existiert dein Benutzerprofil. Im SQL Editor ausführen
(deine E-Mail ist bereits eingesetzt):

```sql
update benutzer
set rollen = array['admin','mannschaftsfuehrer','spieler']::rolle_typ[],
    mf_von_mannschaften = (select array_agg(id) from mannschaften)
where id = (select id from auth.users where email = 'carsten.schulte@gmail.com');
```

Danach in der App einmal neu laden.

**Abnahme:** Du meldest dich per Mail-Link an und siehst die Matrix aller 6
Mannschaften mit Demo-Daten — auch auf dem Handy.

> Hinweis zur DSGVO-Einwilligung: Der Einwilligungs-Dialog erscheint nur, wenn
> dein Login mit einem Spieler verknüpft ist (gleiche E-Mail). Deine echte
> Adresse gehört zu keinem Demo-Spieler, daher geht es für dich direkt zur
> Matrix. Der Dialog selbst ist gebaut und greift für echte Spieler.

## Gelöst: Kommentar-Maskierung (offener Punkt aus M1)

Die sensiblen Freitext-Kommentare (`verfuegbarkeiten.kommentar`) werden jetzt
über die View `v_verfuegbarkeiten` maskiert: Nur der Spieler selbst, sein
Mannschaftsführer und der Admin sehen den Text — alle anderen sehen in der
Matrix nur den Status. Die Matrix liest ausschließlich über diese View.

---

# Meilenstein 3 — Telegram-Bot

Neu: Verfügbarkeits-Abfragen laufen über Telegram. Der Bot koppelt sich per
persönlichem Link mit einem Spieler (`/start`-Deeplink), verschickt Abfragen mit
Inline-Buttons `[✅ Ja] [❌ Nein] [🤔 Unsicher]`, schreibt die Antwort direkt in
die Matrix (inkl. `audit_log`) und erinnert offene Abfragen automatisch
(Scheduler). Alles serverseitig als Next.js-API-Routen, der Bot nutzt den
service_role-Key.

## Einrichtung Meilenstein 3 — Schritt für Schritt

### 1. Abhängigkeiten & Migration

```bash
cd ~/Aufstellungsassistent
npm install
```

Im Supabase **SQL Editor** `supabase/migrations/0005_telegram.sql` ausführen.

### 2. Zwei Geheimnisse erzeugen

Im Terminal zweimal ausführen und die Ausgaben notieren:

```bash
openssl rand -hex 32   # -> für TELEGRAM_WEBHOOK_SECRET
openssl rand -hex 32   # -> für CRON_SECRET
```

### 3. Umgebungsvariablen eintragen (lokal UND Vercel)

In `.env.local` ergänzen (und dieselben drei Werte in Vercel unter
**Settings → Environment Variables**):

```
TELEGRAM_BOT_TOKEN=<dein frischer BotFather-Token>
TELEGRAM_WEBHOOK_SECRET=<erste Zufallszeichenkette>
CRON_SECRET=<zweite Zufallszeichenkette>
```

Danach den neuen Stand hochladen (`git add -A && git commit -m "M3: Telegram-Bot"
&& git push`) — Vercel deployt automatisch mit den neuen Variablen.

### 4. Webhook setzen

Damit Telegram den Bot über die Online-App erreicht, einmal im Terminal
(Token und Secret einsetzen):

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://aufstellungs-assistent.vercel.app/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Antwort sollte `{"ok":true, ... "description":"Webhook was set"}` sein.

### 5. Dich selbst koppeln und testen

1. Öffne `https://aufstellungs-assistent.vercel.app/koppeln` (oben rechts in der
   Matrix „Telegram-Kopplung", nur als Admin/MF sichtbar).
2. Bei einem beliebigen Demo-Spieler auf **Link erzeugen** → **den Link öffnen**
   → in Telegram auf **Start** tippen. Der Bot meldet „Verbunden!".
3. Beim selben Spieler auf **Testabfrage** klicken → du bekommst in Telegram die
   Spieltag-Frage mit den Buttons.
4. Tippe **✅ Ja** → in der Matrix wird die Zelle dieses Spielers für den
   Spieltag sekundenschnell grün.

**Abnahme:** Test-Spieler bekommt die Abfrage in Telegram, tippt Ja, grüner
Haken erscheint live in der Matrix.

## Scheduler

`vercel.json` legt zwei tägliche Cron-Jobs an (Erstabfrage & Reminder, Zeiten in
UTC ~ morgens Europe/Berlin). Sie laufen nach dem Deployment automatisch und
sind über `CRON_SECRET` geschützt. Manuell testen kannst du sie im Browser:
`https://aufstellungs-assistent.vercel.app/api/cron/erstabfrage?secret=<CRON_SECRET>`.
