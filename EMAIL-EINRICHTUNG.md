# E-Mail-Kanal einrichten — Schritt für Schritt

Ziel: Spieler ohne Telegram bekommen ihre Spieltags-Abfragen per E-Mail und
können mit einem Klick antworten. Rechne mit 15–20 Minuten.

Reihenfolge einhalten: erst Brevo (Schritte 1–4), dann Vercel (5–6),
dann Datenbank (7), dann Code hochladen (8), dann testen (9).

---

## Schritt 1 — Brevo-Konto anlegen

1. Auf <https://www.brevo.com> gehen, **Sign up free**.
2. Mit deiner E-Mail registrieren, Bestätigungsmail anklicken.
3. Beim Einrichtungs-Assistenten nach dem Verwendungszweck gefragt:
   **Transactional emails** wählen (nicht Marketing/Newsletter).

**Kosten:** Der kostenlose Tarif erlaubt **300 E-Mails pro Tag**. Bei 40 Spielern
und ~20 Spieltagen pro Halbserie liegen wir weit darunter — es bleibt gratis.
Wenn Brevo beim Registrieren nach Firmendaten fragt: Vereinsname reicht.

---

## Schritt 2 — Absenderadresse verifizieren

Brevo verschickt nur von Adressen, die dir nachweislich gehören.

1. Links im Menü auf **Senders, Domains & Dedicated IPs** → Reiter **Senders**.
2. **Add a sender**: Name z. B. `Aufstellungs-Assistent`, Adresse z. B.
   deine Vereins- oder eine eigene Adresse.
3. Brevo schickt an diese Adresse eine Bestätigungsmail → Link anklicken.
4. Der Sender muss danach als **verified** (grüner Haken) angezeigt werden.

> **Tipp:** Nimm eine Adresse, unter der dich Spieler erreichen können. Wenn
> jemand auf die Abfrage-Mail antwortet, landet das dort — die App liest solche
> Antworten nicht mit.

---

## Schritt 3 — API-Schlüssel erzeugen

1. Oben rechts auf deinen Namen → **SMTP & API**.
2. Reiter **API keys** → **Generate a new API key**.
3. Name z. B. `aufstellungs-assistent`, dann **Generate**.
4. Der Schlüssel (beginnt mit `xkeysib-`) wird **nur einmal** angezeigt.
   Kopiere ihn direkt in Schritt 5 hinein.

> **Wichtig:** Der Schlüssel ist wie ein Passwort. Nicht in den Code, nicht in
> WhatsApp, nicht in unseren Chat — nur in Vercel und ggf. deine `.env.local`.

---

## Schritt 4 — Geheimnis für die Antwortlinks erzeugen

Die Ein-Klick-Buttons in der Mail enthalten eine Signatur, damit niemand fremde
Antworten fälschen kann. Dafür brauchst du eine lange Zufallszeichenkette.

Terminal öffnen und eingeben:

```bash
openssl rand -hex 32
```

Das Ergebnis (64 Zeichen) kopieren — das ist gleich `ANTWORT_SECRET`.

---

## Schritt 5 — Variablen in Vercel eintragen

1. <https://vercel.com> → dein Projekt → **Settings** → **Environment Variables**.
2. Diese fünf Einträge anlegen, jeweils für **Production**, **Preview** und
   **Development** (Häkchen bei allen dreien):

| Name | Wert |
|---|---|
| `BREVO_API_KEY` | der Schlüssel aus Schritt 3 (`xkeysib-…`) |
| `MAIL_ABSENDER_ADRESSE` | die verifizierte Adresse aus Schritt 2 |
| `MAIL_ABSENDER_NAME` | `Aufstellungs-Assistent` |
| `APP_URL` | die öffentliche Adresse der App, z. B. `https://aufstellung.vercel.app` — **ohne** Schrägstrich am Ende |
| `ANTWORT_SECRET` | die 64 Zeichen aus Schritt 4 |

3. Jeweils **Save**.

`APP_URL` muss stimmen, sonst zeigen die Antwortlinks ins Leere.

---

## Schritt 6 — Dieselben Werte lokal (optional)

Nur nötig, wenn du auf deinem Rechner testen willst. In der Datei `.env.local`
im Projektordner ergänzen (die Datei ist bewusst nicht im Repo):

```
BREVO_API_KEY=xkeysib-...
MAIL_ABSENDER_ADRESSE=...
MAIL_ABSENDER_NAME=Aufstellungs-Assistent
APP_URL=http://localhost:3000
ANTWORT_SECRET=...
```

---

## Schritt 7 — Datenbank-Migrationen ausführen

Supabase öffnen → **SQL Editor** → **New query**. Die beiden Dateien einzeln
ausführen, Inhalt jeweils aus dem Projektordner kopieren:

1. `supabase/migrations/0016_spiel_aenderungsstempel.sql`
2. `supabase/migrations/0017_quelle_email.sql`

Nacheinander, jeweils **Run**. Beide sind so gebaut, dass ein zweiter Durchlauf
nichts kaputt macht — falls du 0016 schon ausgeführt hast, einfach nochmal.

> Bei 0017 (`alter type quelle_typ add value`) bitte wirklich als **eigene**
> Query laufen lassen, nicht zusammen mit anderem SQL.

---

## Schritt 8 — Code hochladen

Im Projektordner im Terminal:

```bash
cd ~/Projects/hauswachter/Aufstellungsassistent
git add -A
git commit -m "Email channel: one-click answers, per-player channel, consent safeguards"
git push
```

Vercel baut automatisch. Nach etwa zwei Minuten zeigt die App oben rechts
(als Admin) den neuen Zeitstempel — daran erkennst du, dass die neue Version live ist.

---

## Schritt 9 — Testen, bevor du es auf alle loslässt

1. **Bei dir selbst anfangen.** Kader öffnen → bei deinem eigenen Spieler
   Benachrichtigung auf **E-Mail** stellen und deine Adresse eintragen.
2. Einen Spieltag öffnen → Abfrage auslösen.
3. In deinem Postfach prüfen:
   - Kommt die Mail an (auch im Spam nachsehen)?
   - Steht oben der blaue Kasten „Ab sofort erreichen dich die Abfragen per E-Mail"?
   - Steht unten die Fußzeile mit dem Abmeldehinweis?
4. Auf **Ich bin dabei** klicken → es sollte sich eine Bestätigungsseite öffnen
   und der Status in der Matrix auf zugesagt springen.
5. Gegenprobe: unter **Spieltagsplanung → Meine Präferenzen** den Schalter
   *Keine E-Mails an mich* setzen, erneut Abfrage auslösen — es darf **keine**
   Mail mehr kommen. Danach Schalter wieder aus.

Erst wenn das sauber läuft, weitere Adressen im Kader eintragen.

---

## Schritt 10 — Die anderen informieren

Landet die erste Mail unangekündigt im Postfach, wirkt das wie Spam. Sag den
Mannschaftsführern vorher kurz Bescheid, etwa:

> Ab sofort können Spieltags-Abfragen auch per E-Mail kommen, wenn jemand kein
> Telegram nutzt. Antworten geht per Klick direkt in der Mail. Wer keine Mails
> will, schaltet sie in der App unter Spieltagsplanung → Meine Präferenzen
> selbst ab.

---

## Wenn etwas nicht klappt

| Symptom | Ursache / Lösung |
|---|---|
| Es kommt gar keine Mail | `BREVO_API_KEY` oder `MAIL_ABSENDER_ADRESSE` fehlt bzw. ist nur für eine Umgebung gesetzt. In Vercel prüfen, danach **Redeploy** — neue Variablen greifen erst nach einem neuen Build. |
| „Sender not valid" in Brevo | Absender aus Schritt 2 ist noch nicht bestätigt. |
| Antwortlink führt zu „Link ungültig" | `ANTWORT_SECRET` wurde nachträglich geändert — alte Links gelten dann nicht mehr. Einfach neu abfragen. |
| Antwortlink führt auf eine leere Seite | `APP_URL` falsch oder mit Schrägstrich am Ende. |
| Mail landet im Spam | Normal am Anfang. Wird deutlich besser, wenn du in Brevo unter *Senders, Domains* deine eigene **Domain verifizierst** (DNS-Einträge) statt nur einer einzelnen Adresse. |
| Spieler bekommt trotz E-Mail-Kanal nichts | Er hat *Keine E-Mails an mich* gesetzt. Im Kader steht dann ein oranger Hinweis bei ihm. |

---

## Was das System von sich aus beachtet

- Jede Mail nennt in der Fußzeile den Grund und den Weg zum Abschalten.
- Die allererste Mail an einen Spieler bekommt eine kurze Ankündigung.
- Der Schalter *Keine E-Mails an mich* sticht die Kanal-Einstellung des MF —
  der Spieler entscheidet, nicht die Mannschaftsführung.
- Wer weder Telegram noch (erlaubte) E-Mail hat, taucht beim MF als
  „bitte persönlich anfragen" auf, statt still übergangen zu werden.
