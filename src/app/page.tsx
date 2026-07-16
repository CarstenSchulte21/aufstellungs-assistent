import { createClient } from "@/lib/supabase/server";

// Immer frisch laden, nie statisch cachen (Health-Check gegen die DB).
export const dynamic = "force-dynamic";

type Mannschaft = {
  nummer: number;
  name: string;
  liga: string | null;
  spielstaerke: number;
};

async function ladeMannschaften(): Promise<
  { ok: true; daten: Mannschaft[] } | { ok: false; fehler: string }
> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return {
      ok: false,
      fehler:
        "Keine Supabase-Zugangsdaten gefunden. Trage NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local ein.",
    };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("mannschaften")
      .select("nummer, name, liga, spielstaerke")
      .order("nummer", { ascending: true });

    if (error) return { ok: false, fehler: error.message };
    return { ok: true, daten: (data ?? []) as Mannschaft[] };
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : String(e) };
  }
}

export default async function Home() {
  const ergebnis = await ladeMannschaften();

  return (
    <main className="min-h-screen">
      <header className="bg-primary text-white">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-xl font-semibold">Aufstellungs-Assistent</h1>
          <p className="text-sm text-white/80">
            Spieltag-Planung für unsere Tischtennis-Mannschaften
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            Datenbank-Verbindung
          </h2>

          {ergebnis.ok ? (
            <div>
              <p className="mb-4 text-sm text-green-700">
                ✓ Verbindung zu Supabase steht. {ergebnis.daten.length} Mannschaften
                geladen.
              </p>
              <ul className="divide-y divide-gray-100 rounded-md border border-gray-100">
                {ergebnis.daten.map((m) => (
                  <li
                    key={m.nummer}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-gray-900">
                      {m.nummer}. {m.name}
                    </span>
                    <span className="text-gray-500">
                      {m.liga} · {m.spielstaerke}er
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-medium">Noch keine Verbindung.</p>
              <p className="mt-1">{ergebnis.fehler}</p>
            </div>
          )}
        </section>

        <p className="mt-6 text-xs text-gray-400">
          Meilenstein 1 — Projektgerüst &amp; Datenbank. Die Screens folgen ab
          Meilenstein 2.
        </p>
      </div>
    </main>
  );
}
