import { useState, useMemo } from "react";

// ───────────────────────────── Demo-Daten ─────────────────────────────
// Deterministischer Pseudo-Zufall, damit der Prototyp stabil aussieht
const h = (s) => {
  let x = 7;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) % 9973;
  return x;
};

const TEAMS = [
  { id: "M1", name: "1. Mannschaft", liga: "Bezirksoberliga", size: 6 },
  { id: "M2", name: "2. Mannschaft", liga: "Bezirksklasse", size: 4 },
  { id: "M3", name: "3. Mannschaft", liga: "1. Kreisklasse", size: 4 },
  { id: "M4", name: "4. Mannschaft", liga: "2. Kreisklasse", size: 4 },
  { id: "M5", name: "5. Mannschaft", liga: "3. Kreisklasse", size: 4 },
  { id: "M6", name: "6. Mannschaft", liga: "3. Kreisklasse", size: 4 },
];

const PLAYERS = [
  // team, pos, name, qttr, status, kanal
  ["M1", 1, "Markus Weber", 1748], ["M1", 2, "Thomas Klein", 1721],
  ["M1", 3, "Stefan Brandt", 1699], ["M1", 4, "Oliver Hartmann", 1672],
  ["M1", 5, "Jan Peters", 1651], ["M1", 6, "Daniel Fuchs", 1628],
  ["M2", 1, "Carsten Möller", 1602], ["M2", 2, "Andreas Schmitz", 1580],
  ["M2", 3, "Peter Lang", 1566], ["M2", 4, "Michael Busch", 1549],
  ["M2", 5, "Frank Otto", 1531], ["M2", 6, "Sven Richter", 1512],
  ["M2", 7, "Tobias Kraus", 1498],
  ["M3", 1, "Jürgen Wolf", 1489], ["M3", 2, "Ralf Sommer", 1470],
  ["M3", 3, "Christian Beck", 1455], ["M3", 4, "Matthias Jung", 1441],
  ["M3", 5, "Dirk Hansen", 1420], ["M3", 6, "Uwe Berger", 1402],
  ["M3", 7, "Leon Krämer", 1390],
  ["M4", 1, "Holger Schnell", 1378], ["M4", 2, "Bernd Vogt", 1355],
  ["M4", 3, "Lukas Meier", 1340], ["M4", 4, "Simon Roth", 1322],
  ["M4", 5, "Klaus Werner", 1301], ["M4", 6, "Georg Simon", 1287],
  ["M5", 1, "Heinz Baumann", 1260], ["M5", 2, "Volker Krause", 1244],
  ["M5", 3, "Nils Winter", 1228], ["M5", 4, "Timo Schulte", 1210],
  ["M5", 5, "Erik Lorenz", 1195], ["M5", 6, "Paul Menzel", 1181],
  ["M6", 1, "Wolfgang Hess", 1158], ["M6", 2, "Rainer Kuhn", 1140],
  ["M6", 3, "Jonas Ebert", 1122], ["M6", 4, "Felix Nagel", 1105],
  ["M6", 5, "Horst Adler", 1090], ["M6", 6, "Karl Voss", 1074],
].map(([team, pos, name, qttr]) => ({
  id: name.toLowerCase().replace(/[^a-z]/g, ""),
  team, pos, name, qttr,
}));

const INITIAL_PLAYER_META = Object.fromEntries(
  PLAYERS.map((p) => {
    let status = "aktiv", kanal = "Telegram", note = "";
    if (p.name === "Michael Busch") { status = "pausiert"; note = "Knie-OP, zurück ca. Nov."; }
    if (p.name === "Karl Voss") { status = "inaktiv"; note = "Seit 2024 nicht aktiv"; }
    if (p.name === "Horst Adler") { kanal = "Proxy"; note = "Kein Smartphone – Eintrag über MF"; }
    if (p.name === "Uwe Berger") kanal = "Webapp";
    return [p.id, { status, kanal, note }];
  })
);

const GEGNER = [
  "TTC Grün-Weiß Brühl", "DJK Frechen", "TTV Erftstadt", "TTG Wesseling",
  "TTF Kerpen", "SV Pulheim 08", "TTC Lövenich", "Borussia Lindenthal",
];

// 8 Spieltage Hinrunde 2026/27 je Mannschaft, Termine leicht versetzt
const MATCHDAYS = {};
TEAMS.forEach((t, ti) => {
  const base = new Date(2026, 8, 5); // 05.09.2026
  MATCHDAYS[t.id] = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i * 14 + ((h(t.id + i) % 3) - 1));
    const gi = (ti * 3 + i * 5) % GEGNER.length;
    return {
      id: `${t.id}-S${i + 1}`,
      nr: i + 1,
      date: d,
      gegner: GEGNER[gi],
      heim: (h(t.id + "h" + i) % 2) === 0,
    };
  });
});

const fmt = (d) =>
  d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

// Basis-Status je Spieler × Spieltag (deterministisch)
const baseStatus = (pid, mid) => {
  const v = h(pid + "|" + mid) % 100;
  if (v < 54) return "zu";
  if (v < 68) return "ab";
  if (v < 86) return "offen";
  return "stumm";
};

const STATUS_UI = {
  zu:    { label: "Zugesagt",            chip: "✓", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ab:    { label: "Abgesagt",            chip: "✕", cls: "bg-rose-100 text-rose-600 border-rose-200" },
  offen: { label: "Angefragt",           chip: "?", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  stumm: { label: "Keine Antwort (2× erinnert)", chip: "○", cls: "bg-slate-100 text-slate-400 border-slate-200" },
  pause: { label: "Pausiert",            chip: "–", cls: "bg-slate-50 text-slate-300 border-slate-100" },
};

// ───────────────────────────── UI-Bausteine ─────────────────────────────
function Chip({ s }) {
  const u = STATUS_UI[s];
  return (
    <span
      title={u.label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-bold ${u.cls}`}
    >
      {u.chip}
    </span>
  );
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-600",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

// ───────────────────────────── Hauptkomponente ─────────────────────────────
export default function AufstellungPrototyp() {
  const [teamId, setTeamId] = useState("M2");
  const [view, setView] = useState("matrix"); // matrix | kader
  const [openDay, setOpenDay] = useState(null);
  const [meta, setMeta] = useState(INITIAL_PLAYER_META);
  const [requests, setRequests] = useState({ lukasmeier: "M4" }); // vereinsweiter Lock-Demo

  const team = TEAMS.find((t) => t.id === teamId);
  const days = MATCHDAYS[teamId];
  const roster = useMemo(
    () => PLAYERS.filter((p) => p.team === teamId).sort((a, b) => a.pos - b.pos),
    [teamId]
  );

  const cellStatus = (p, m) =>
    meta[p.id].status !== "aktiv" ? "pause" : baseStatus(p.id, m.id);

  const dayStats = (m) => {
    const zu = roster.filter((p) => cellStatus(p, m) === "zu").length;
    return { zu, need: team.size };
  };

  // Ersatzkandidaten: nächstuntere Mannschaft, regelkonform annotiert (Demo-Logik)
  const candidates = (m) => {
    const idx = TEAMS.findIndex((t) => t.id === teamId);
    if (idx === TEAMS.length - 1) return [];
    const lower = TEAMS[idx + 1];
    return PLAYERS.filter((p) => p.team === lower.id && meta[p.id].status === "aktiv")
      .sort((a, b) => a.pos - b.pos)
      .slice(0, 4)
      .map((p) => {
        const v = h(p.id + m.id + "c") % 100;
        const einsaetze = h(p.id) % 3;
        const warns = [];
        if (einsaetze === 2) warns.push("2. Ersatzeinsatz – beim 3. festgespielt");
        if (v < 25) warns.push(`spielt am selben Tag mit der ${lower.name}`);
        if (v >= 25 && v < 40) warns.push("Präferenz: keine Doppeleinsätze");
        const locked = requests[p.id] && requests[p.id] !== teamId;
        return { ...p, lowerName: lower.name, einsaetze, warns, locked };
      });
  };

  const askCandidate = (pid) => setRequests((r) => ({ ...r, [pid]: teamId }));
  const setPlayerStatus = (pid, status) =>
    setMeta((m) => ({ ...m, [pid]: { ...m[pid], status } }));

  const day = openDay ? days.find((d) => d.id === openDay) : null;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Kopfzeile */}
      <header className="border-b border-slate-200 bg-[#123c73] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-lg">
            🏓
          </div>
          <div className="mr-auto">
            <div className="text-[15px] font-bold leading-tight tracking-tight">
              Aufstellung · TTC Blau-Gold Hürth
            </div>
            <div className="text-[11px] text-blue-200">
              Hinrunde 2026/27 · Angemeldet als Mannschaftsführer (Carsten)
            </div>
          </div>
          <nav className="flex gap-1 rounded-lg bg-white/10 p-1 text-sm">
            {[
              ["matrix", "Saison-Matrix"],
              ["kader", "Kader"],
            ].map(([v, label]) => (
              <button
                key={v}
                onClick={() => { setView(v); setOpenDay(null); }}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  view === v ? "bg-white text-[#123c73]" : "text-blue-100 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Mannschaftswahl */}
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="flex flex-wrap gap-2">
          {TEAMS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTeamId(t.id); setOpenDay(null); }}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                t.id === teamId
                  ? "border-[#123c73] bg-[#123c73] text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {t.name}
              <span className={`ml-1.5 text-[11px] ${t.id === teamId ? "text-blue-200" : "text-slate-400"}`}>
                {t.liga}
              </span>
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {view === "matrix" && !day && (
          <MatrixView
            team={team} roster={roster} days={days} meta={meta}
            cellStatus={cellStatus} dayStats={dayStats} onOpen={setOpenDay}
          />
        )}
        {view === "matrix" && day && (
          <DayDetail
            team={team} day={day} roster={roster} meta={meta}
            cellStatus={cellStatus} dayStats={dayStats}
            candidates={candidates(day)} requests={requests}
            onAsk={askCandidate} onBack={() => setOpenDay(null)}
          />
        )}
        {view === "kader" && (
          <KaderView team={team} roster={roster} meta={meta} onStatus={setPlayerStatus} />
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-6 text-[11px] text-slate-400">
        Klickbarer Prototyp · Demo-Daten · Phase 1: Matrix, Abfragen & Kaderpflege — Ersatzlogik als Vorschau
      </footer>
    </div>
  );
}

// ───────────────────────────── Saison-Matrix ─────────────────────────────
function MatrixView({ team, roster, days, meta, cellStatus, dayStats, onOpen }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-4 py-3">
        <h2 className="mr-auto text-[15px] font-bold tracking-tight">
          {team.name} · Saison-Matrix
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          {Object.entries(STATUS_UI).slice(0, 4).map(([k, u]) => (
            <span key={k} className="flex items-center gap-1">
              <Chip s={k} /> {u.label.split(" (")[0]}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Spieler
              </th>
              {days.map((m) => {
                const st = dayStats(m);
                const ok = st.zu >= st.need;
                return (
                  <th key={m.id} className="px-1.5 py-2 align-bottom">
                    <button
                      onClick={() => onOpen(m.id)}
                      className={`w-full rounded-lg border px-2 py-1.5 text-left transition hover:shadow ${
                        ok ? "border-slate-200 bg-slate-50" : "border-amber-300 bg-amber-50"
                      }`}
                    >
                      <div className="text-[11px] font-bold text-slate-700">{fmt(m.date)}</div>
                      <div className="max-w-[92px] truncate text-[10px] text-slate-500">
                        {m.heim ? "H" : "A"} · {m.gegner}
                      </div>
                      <div className={`mt-1 text-[11px] font-bold ${ok ? "text-emerald-600" : "text-amber-600"}`}>
                        {st.zu}/{st.need} {ok ? "✓" : "⚠"}
                      </div>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {roster.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-1.5">
                  <span className="mr-2 inline-block w-5 text-right text-[11px] font-bold text-slate-300">
                    {p.pos}
                  </span>
                  <span className={meta[p.id].status !== "aktiv" ? "text-slate-400 line-through" : "font-medium"}>
                    {p.name}
                  </span>
                  {meta[p.id].status === "pausiert" && <span className="ml-2"><Badge tone="amber">pausiert</Badge></span>}
                  {meta[p.id].status === "inaktiv" && <span className="ml-2"><Badge>inaktiv</Badge></span>}
                </td>
                {days.map((m) => (
                  <td key={m.id} className="px-1.5 py-1.5 text-center">
                    <Chip s={cellStatus(p, m)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 px-4 py-2.5 text-[12px] text-slate-500">
        Spieltag anklicken für Lückenanalyse und Ersatzvorschläge. Der Bot erinnert offene Anfragen automatisch nach 48 h.
      </div>
    </section>
  );
}

// ───────────────────────────── Spieltag-Detail ─────────────────────────────
function DayDetail({ team, day, roster, meta, cellStatus, dayStats, candidates, requests, onAsk, onBack }) {
  const st = dayStats(day);
  const missing = Math.max(0, st.need - st.zu);
  const groups = { zu: [], ab: [], offen: [], stumm: [], pause: [] };
  roster.forEach((p) => groups[cellStatus(p, day)].push(p));

  return (
    <section className="space-y-4">
      <button onClick={onBack} className="text-sm font-medium text-[#123c73] hover:underline">
        ← Zurück zur Matrix
      </button>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              Spieltag {day.nr} · {fmt(day.date)} · {day.heim ? "Heim" : "Auswärts"} gegen {day.gegner}
            </h2>
            <p className="text-sm text-slate-500">{team.name} · {team.liga} · benötigt: {st.need} Spieler</p>
          </div>
          <div className={`rounded-lg px-3 py-2 text-center ${missing ? "bg-amber-50" : "bg-emerald-50"}`}>
            <div className={`text-xl font-black ${missing ? "text-amber-600" : "text-emerald-600"}`}>
              {st.zu}/{st.need}
            </div>
            <div className="text-[11px] font-medium text-slate-500">
              {missing ? `${missing} fehlt` : "vollständig"}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[["zu", "green"], ["offen", "amber"], ["ab", "rose"], ["stumm", "slate"]].map(([k]) => (
            <div key={k} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-slate-600">
                <Chip s={k} /> {STATUS_UI[k].label}
                <span className="text-slate-400">({groups[k].length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {groups[k].length === 0 && <span className="text-[12px] text-slate-400">—</span>}
                {groups[k].map((p) => (
                  <Badge key={p.id} tone={k === "zu" ? "green" : k === "ab" ? "rose" : k === "offen" ? "amber" : "slate"}>
                    {p.name}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        {day.nr === 3 && (
          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] text-blue-800">
            ℹ Parallelspieltag: An diesem Datum spielen auch die 4. und 5. Mannschaft — Ersatzkandidaten werden entsprechend gefiltert.
          </div>
        )}
      </div>

      {/* Ersatzvorschläge */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-[15px] font-bold tracking-tight">
          Ersatzvorschläge {missing > 0 ? `(${missing} Lücke${missing > 1 ? "n" : ""})` : "(Vorschau)"}
        </h3>
        <p className="mb-3 mt-0.5 text-[12px] text-slate-500">
          Regelkonform ermittelt nach deiner Mannschaftskonfiguration · Anfrage geht erst nach deiner Freigabe per Telegram raus
        </p>

        {candidates.length === 0 ? (
          <p className="text-sm text-slate-500">
            Keine untere Mannschaft vorhanden — bei Lücken schlägt das System hier die Verlegungs-Mail vor.
          </p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c, i) => {
              const asked = requests[c.id] === team.id;
              return (
                <div
                  key={c.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
                    c.locked ? "border-slate-100 bg-slate-50 opacity-70" : "border-slate-200"
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[12px] font-bold text-slate-500">
                    {i + 1}
                  </span>
                  <div className="mr-auto min-w-[180px]">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-[12px] text-slate-500">
                      {c.lowerName} · Pos. {c.pos} · QTTR {c.qttr} · {c.einsaetze} Ersatzeinsätze diese Halbserie
                    </div>
                    {c.warns.map((w) => (
                      <div key={w} className="mt-0.5 text-[12px] font-medium text-amber-600">⚠ {w}</div>
                    ))}
                    {c.locked && (
                      <div className="mt-0.5 text-[12px] font-medium text-slate-500">
                        🔒 Bereits angefragt von der {TEAMS.find((t) => t.id === requests[c.id])?.name} — Lock aktiv
                      </div>
                    )}
                  </div>
                  {asked ? (
                    <Badge tone="amber">Angefragt · Antwortfrist 48 h</Badge>
                  ) : (
                    <button
                      disabled={c.locked}
                      onClick={() => onAsk(c.id)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                        c.locked
                          ? "cursor-not-allowed bg-slate-100 text-slate-400"
                          : "bg-[#123c73] text-white hover:bg-[#0d2f5c]"
                      }`}
                    >
                      Anfrage freigeben
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {missing > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-rose-100 bg-rose-50/60 p-3">
            <div className="mr-auto text-[13px] text-rose-700">
              <strong>Keine Aufstellung möglich?</strong> Das System entwirft eine Verlegungs-Mail an {day.gegner} mit freien Ausweichterminen.
            </div>
            <button className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-600 hover:bg-rose-50">
              Verlegungs-Mail entwerfen
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ───────────────────────────── Kader / Onboarding ─────────────────────────────
function KaderView({ team, roster, meta, onStatus }) {
  const KANAL_TONE = { Telegram: "blue", Webapp: "green", Proxy: "amber" };
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-[15px] font-bold tracking-tight">{team.name} · Kader kuratieren</h2>
        <p className="text-[12px] text-slate-500">
          Grundlage: offizielle Mannschaftsmeldung · Nur <strong>aktive</strong> Spieler werden vom Bot angefragt — die Regel-Engine kennt weiterhin alle Gemeldeten.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {roster.map((p) => {
          const m = meta[p.id];
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="w-5 text-right text-[12px] font-bold text-slate-300">{p.pos}</span>
              <div className="mr-auto min-w-[160px]">
                <div className={`font-medium ${m.status === "inaktiv" ? "text-slate-400" : ""}`}>{p.name}</div>
                <div className="text-[12px] text-slate-500">
                  QTTR {p.qttr}
                  {m.note && <span className="ml-2 text-slate-400">· {m.note}</span>}
                </div>
              </div>
              <Badge tone={KANAL_TONE[m.kanal]}>{m.kanal}</Badge>
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-[12px] font-semibold">
                {["aktiv", "pausiert", "inaktiv"].map((s) => (
                  <button
                    key={s}
                    onClick={() => onStatus(p.id, s)}
                    className={`rounded-md px-2.5 py-1 capitalize transition ${
                      m.status === s
                        ? s === "aktiv"
                          ? "bg-emerald-500 text-white"
                          : s === "pausiert"
                          ? "bg-amber-400 text-white"
                          : "bg-slate-500 text-white"
                        : "text-slate-500 hover:bg-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-100 px-4 py-2.5 text-[12px] text-slate-500">
        Statuswechsel wirken sofort: Pausierte Spieler verschwinden aus offenen Abfragen, betroffene Spieltage landen wieder in der Lückenanalyse.
      </div>
    </section>
  );
}
