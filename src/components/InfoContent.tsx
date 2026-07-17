type Rolle = "admin" | "mannschaftsfuehrer" | "spieler";

function Card({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-1 text-[14px] font-bold text-slate-800">
        {icon} {title}
      </h3>
      <div className="space-y-1 text-[13px] text-slate-600">{children}</div>
    </div>
  );
}

export default function InfoContent({ rolle }: { rolle: Rolle }) {
  const istMf = rolle === "mannschaftsfuehrer" || rolle === "admin";
  const istAdmin = rolle === "admin";

  return (
    <div className="space-y-4">
      <Card icon="🏓" title="Worum geht's?">
        <p>
          Der Aufstellungs-Assistent hilft dem Verein, für jeden Spieltag
          rechtzeitig eine vollständige Mannschaft zusammenzubekommen — mit
          Verfügbarkeits-Abfragen per Telegram, einer Saison-Matrix und
          regelkonformen Ersatzvorschlägen.
        </p>
      </Card>

      <Card icon="👤" title="Für dich als Spieler">
        <p>
          <strong>Anfragen beantworten:</strong> Du bekommst pro Spieltag eine
          Anfrage per Telegram (oder in der App) und tippst ✅ / ❌ / 🤔. Deine
          Antwort landet sofort in der Matrix; du kannst sie jederzeit ändern.
        </p>
        <p>
          <strong>Meine Spieltage:</strong> alle Spiele deiner Mannschaft mit
          Ein-Klick-Zu-/Absage, deine Abwesenheiten (Urlaub etc.) und
          Ersatzanfragen anderer Mannschaften an dich.
        </p>
        <p>
          <strong>Telegram koppeln:</strong> Über den persönlichen Link deines
          Mannschaftsführers verbindest du dich einmalig mit dem Bot.
        </p>
      </Card>

      {istMf && (
        <Card icon="📋" title="Für dich als Mannschaftsführer">
          <p>
            <strong>Meine Mannschaft &amp; Kader:</strong> eigene Sicht auf dein
            Team; Kader pflegen (aktiv/pausiert/inaktiv), Kanal &amp;
            Präferenzen, Einladungen verschicken.
          </p>
          <p>
            <strong>Ersatzvorschläge:</strong> Bei Lücken zeigt dir das
            Spieltag-Detail regelkonforme Kandidaten (nur von unten, kein
            Sperrvermerk, nicht am selben Tag verplant). „Anfrage freigeben“
            schickt sie per Telegram; zugesagte Ersatzspieler planst du fest ein.
          </p>
          <p>
            <strong>Regeln &amp; Inbox:</strong> deine Ersatz-Regeln je
            Mannschaft, und eine Inbox mit allen offenen Entscheidungen.
          </p>
        </Card>
      )}

      {istAdmin && (
        <Card icon="⚙️" title="Für dich als Admin">
          <p>
            <strong>Verwaltung:</strong> Spielplan pflegen, Spielerstamm &amp;
            Mannschaftsmeldung, und die Mannschaftsführung (MF/Stellvertreter je
            Mannschaft) festlegen.
          </p>
        </Card>
      )}

      <Card icon="🔒" title="Datenschutz">
        <p>
          <strong>Zweck:</strong> Die App verarbeitet deine Daten ausschließlich
          für die Spieltagsplanung des Vereins.
        </p>
        <p>
          <strong>Daten:</strong> Name, Kontaktdaten, deine Zu-/Absagen und
          Abwesenheiten. In der Matrix sind für den Verein nur deine Status
          sichtbar — Freitext-Kommentare sehen nur du, dein Mannschaftsführer und
          der Admin.
        </p>
        <p>
          <strong>Bot:</strong> Ohne deine Einwilligung bekommst du keine
          Telegram-Nachrichten; die App kannst du im Lesemodus nutzen.
        </p>
        <p>
          <strong>Widerruf:</strong> jederzeit gegenüber deinem
          Mannschaftsführer möglich.
        </p>
      </Card>
    </div>
  );
}
