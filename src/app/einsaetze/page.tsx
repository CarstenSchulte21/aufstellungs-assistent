import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import EinsatzForm, { type Opt } from "./EinsatzForm";

export const dynamic = "force-dynamic";

type ProTeam = { nummer: number; name: string; count: number };
type Row = {
  id: string;
  name: string;
  meldung: number;
  proTeam: ProTeam[];
  gesamt: number;
};

export default async function EinsaetzePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin) redirect("/");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: hs } = await supabase
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();
  const halbserieId = hs?.id ?? "";

  const { data: teams } = await supabase
    .from("mannschaften")
    .select("id, nummer, name")
    .order("nummer");
  const teamInfo = new Map<string, { nummer: number; name: string }>(
    (teams ?? []).map((t: any) => [t.id, { nummer: t.nummer, name: t.name }])
  );

  const { data: meld } = await supabase
    .from("meldungen")
    .select("spieler_id, mannschaften:mannschaft_id(nummer), spieler:spieler_id(name)")
    .eq("halbserie_id", halbserieId);

  // Einsätze je Spieler und Mannschaft
  const { data: eins } = await supabase
    .from("einsaetze")
    .select("spieler_id, mannschaft_id")
    .eq("halbserie_id", halbserieId);
  const proSpielerTeam = new Map<string, Map<string, number>>();
  for (const e of eins ?? []) {
    const sid = (e as any).spieler_id;
    const mid = (e as any).mannschaft_id;
    if (!proSpielerTeam.has(sid)) proSpielerTeam.set(sid, new Map());
    const m = proSpielerTeam.get(sid)!;
    m.set(mid, (m.get(mid) ?? 0) + 1);
  }

  const rows: Row[] = (meld ?? []).map((m: any): Row => {
    const proMid = proSpielerTeam.get(m.spieler_id) ?? new Map<string, number>();
    const proTeam: ProTeam[] = Array.from(proMid.entries())
      .map(([mid, count]) => ({
        nummer: teamInfo.get(mid)?.nummer ?? 0,
        name: teamInfo.get(mid)?.name ?? "",
        count,
      }))
      .sort((a, b) => a.nummer - b.nummer);
    const gesamt = proTeam.reduce((s, t) => s + t.count, 0);
    return {
      id: m.spieler_id,
      name: m.spieler?.name ?? "—",
      meldung: m.mannschaften?.nummer ?? 0,
      proTeam,
      gesamt,
    };
  });
  rows.sort((a, b) => b.gesamt - a.gesamt || a.name.localeCompare(b.name));

  // Optionen für den Admin-Nachtrag
  const spielerOpts: Opt[] = (meld ?? [])
    .map((m: any) => ({ id: m.spieler_id, label: m.spieler?.name ?? "—" }))
    .sort((a: Opt, b: Opt) => a.label.localeCompare(b.label));
  const teamOpts: Opt[] = (teams ?? []).map((t: any) => ({
    id: t.id,
    label: t.name,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userEmail={user?.email ?? ""}
        isAdmin={session.isAdmin}
        isMf={session.isMf}
        realIsAdmin={session.realIsAdmin}
        realIsMf={session.realIsMf}
        hatManagement={session.hatManagement}
        modus={session.modus}
      />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <h1 className="mb-1 text-[15px] font-bold text-slate-800">Einsätze</h1>
        <p className="mb-4 text-[12px] text-slate-500">
          Wie oft jemand pro Mannschaft eingeplant wurde (diese Halbserie). Im
          WTTV gibt es kein Festspielen; die Zahlen dienen der Fairness.
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Spieler</th>
                <th className="px-3 py-2">Meldung</th>
                <th className="px-3 py-2">Einsätze je Mannschaft</th>
                <th className="px-3 py-2">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="px-3 py-1.5 font-medium text-slate-800">
                    {r.name}
                  </td>
                  <td className="px-3 py-1.5 text-slate-500">{r.meldung}. M.</td>
                  <td className="px-3 py-1.5">
                    {r.proTeam.length === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {r.proTeam.map((t) => (
                          <span
                            key={t.nummer}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px] text-slate-600"
                          >
                            {t.nummer}. M.: {t.count}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={
                        r.gesamt > 0
                          ? "font-bold text-slate-800"
                          : "text-slate-300"
                      }
                    >
                      {r.gesamt}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5">
          <EinsatzForm
            halbserieId={halbserieId}
            spieler={spielerOpts}
            teams={teamOpts}
          />
        </div>
      </main>
    </div>
  );
}
