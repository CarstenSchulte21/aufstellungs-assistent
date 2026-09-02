import { getAdmin } from "@/lib/supabase/admin";
import {
  pruefeAntwortToken,
  baueAntwortToken,
  type Antwort,
} from "@/lib/antwortToken";
import { upsertVerfuegbarkeit } from "@/lib/telegram/abfrage";
import { heuteBerlin } from "@/lib/cron";

export const dynamic = "force-dynamic";

const LABEL: Record<Antwort, string> = {
  zugesagt: "Ich bin dabei",
  abgesagt: "Ich kann nicht",
  unsicher: "Unsicher",
};
const FARBE: Record<Antwort, string> = {
  zugesagt: "bg-emerald-500",
  abgesagt: "bg-rose-500",
  unsicher: "bg-amber-500",
};

function fmt(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

function Rahmen({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 text-[15px] font-bold text-primary">
          🏓 Aufstellungs-Assistent
        </div>
        {children}
      </div>
    </main>
  );
}

export default async function AntwortPage({
  searchParams,
}: {
  searchParams: { t?: string };
}) {
  const daten = pruefeAntwortToken(searchParams.t ?? "");
  if (!daten) {
    return (
      <Rahmen>
        <p className="text-sm text-slate-700">
          Dieser Link ist ungültig oder nicht mehr gültig. Bitte antworte direkt
          in der App unter „Spieltagsplanung“.
        </p>
      </Rahmen>
    );
  }

  const admin = getAdmin();
  const { data: spiel } = await admin
    .from("spiele")
    .select(
      "id, datum, uhrzeit, heim, gegner, status, mannschaften:mannschaft_id(name)"
    )
    .eq("id", daten.spielId)
    .maybeSingle();
  const { data: spieler } = await admin
    .from("spieler")
    .select("name")
    .eq("id", daten.spielerId)
    .maybeSingle();

  if (!spiel) {
    return (
      <Rahmen>
        <p className="text-sm text-slate-700">Dieser Spieltag existiert nicht mehr.</p>
      </Rahmen>
    );
  }

  const s = spiel as any;
  const beschreibung = `${fmt(s.datum)}${
    s.uhrzeit ? ` · ${String(s.uhrzeit).slice(0, 5)}` : ""
  } · ${s.heim ? "Heim" : "Auswärts"} gegen ${s.gegner}`;

  if (s.status === "abgesetzt") {
    return (
      <Rahmen>
        <p className="text-sm text-slate-700">
          Dieses Spiel wurde abgesetzt — {beschreibung}. Du musst nichts weiter
          tun.
        </p>
      </Rahmen>
    );
  }

  if (s.datum < heuteBerlin()) {
    return (
      <Rahmen>
        <p className="text-sm text-slate-700">
          Dieser Spieltag ({beschreibung}) liegt bereits in der Vergangenheit —
          eine Antwort ist nicht mehr nötig.
        </p>
      </Rahmen>
    );
  }

  await upsertVerfuegbarkeit(
    admin,
    daten.spielId,
    daten.spielerId,
    daten.antwort,
    "email"
  );

  const andere = (["zugesagt", "abgesagt", "unsicher"] as Antwort[]).filter(
    (a) => a !== daten.antwort
  );

  return (
    <Rahmen>
      <div className="rounded-lg bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-900">
          Danke{spieler?.name ? `, ${(spieler as any).name.split(" ")[0]}` : ""}!
          Deine Antwort ist gespeichert.
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          <strong>{LABEL[daten.antwort]}</strong> für {(s.mannschaften as any)?.name}
          : {beschreibung}
        </p>
      </div>

      <p className="mt-4 text-[13px] text-slate-500">
        Falsch getippt? Du kannst deine Antwort hier direkt ändern:
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {andere.map((a) => (
          <a
            key={a}
            href={`/antwort?t=${baueAntwortToken(daten.spielerId, daten.spielId, a)}`}
            className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${FARBE[a]}`}
          >
            {LABEL[a]}
          </a>
        ))}
      </div>

      <p className="mt-4 text-[12px] text-slate-400">
        Alle deine Spieltage findest du in der App unter „Spieltagsplanung“.
      </p>
    </Rahmen>
  );
}
