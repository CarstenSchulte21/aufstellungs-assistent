import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import EinsatzForm, { type Opt } from "./EinsatzForm";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  team: number;
  einsaetze: number;
  angefragt: number;
};

export default async function EinsaetzePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin && !session.isMf) redirect("/");

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

  const { data: meld } = await supabase
    .from("meldungen")
    .select("spieler_id, mannschaften:mannschaft_id(nummer), spieler:spieler_id(name)")
    .eq("halbserie_id", halbserieId);

  const { data: eins } = await supabase
    .from("einsaetze")
    .select("spieler_id")
    .eq("halbserie_id", halbserieId)
    .eq("ersatz", true);
  const einsVon = new Map<string, number>();
  for (const e of eins ?? [])
    einsVon.set((e as any).spieler_id, (einsVon.get((e as any).spieler_id) ?? 0) + 1);

  const { data: anf } = await supabase
    .from("ersatzanfragen")
    .select("spieler_id");
  const anfVon = new Map<string, number>();
  for (const a of anf ?? [])
    anfVon.set((a as any).spieler_id, (anfVon.get((a as any).spieler_id) ?? 0) + 1);

  const rows: Row[] = (meld ?? []).map(
    (m: any): Row => ({
      id: m.spieler_id,
      name: m.spieler?.name ?? "—",
      team: m.mannschaften?.nummer ?? 0,
      einsaetze: einsVon.get(m.spieler_id) ?? 0,
      angefragt: anfVon.get(m.spieler_id) ?? 0,
    })
  );
  rows.sort(
    (a, b) =>
      b.einsaetze - a.einsaetze ||
      b.angefragt - a.angefragt ||
      a.name.localeCompare(b.name)
  );

  // Optionen für den Admin-Nachtrag
  const spielerOpts: Opt[] = (meld ?? [])
    .map((m: any) => ({ id: m.spieler_id, label: m.spieler?.name ?? "—" }))
    .sort((a: Opt, b: Opt) => a.label.localeCompare(b.label));
  const { data: teams } = await supabase
    .from("mannschaften")
    .select("id, name")
    .order("nummer");
  const teamOpts: Opt[] = (teams ?? []).map((t: any) => ({ id: t.id, label: t.name }));

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userEmail={user?.email ?? ""}
        isAdmin={session.isAdmin}
        isMf={session.isMf}
        realIsAdmin={session.realIsAdmin}
        viewAs={session.viewAs}
      />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <h1 className="mb-1 text-[15px] font-bold text-slate-800">
          Einsätze &amp; Fairness
        </h1>
        <p className="mb-4 text-[12px] text-slate-500">
          Ersatzeinsätze dieser Halbserie und wie oft jemand angefragt wurde —
          damit nicht immer dieselben aushelfen. (Im WTTV gibt es kein
          Festspielen; die Zahlen dienen nur der Fairness.)
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Spieler</th>
                <th className="px-3 py-2">Mannschaft</th>
                <th className="px-3 py-2">Ersatzeinsätze</th>
                <th className="px-3 py-2">angefragt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="px-3 py-1.5 font-medium text-slate-800">
                    {r.name}
                  </td>
                  <td className="px-3 py-1.5 text-slate-500">{r.team}. M.</td>
                  <td className="px-3 py-1.5">
                    <span
                      className={
                        r.einsaetze > 0
                          ? "font-bold text-slate-800"
                          : "text-slate-300"
                      }
                    >
                      {r.einsaetze}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-500">{r.angefragt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {session.isAdmin && (
          <div className="mt-5">
            <EinsatzForm
              halbserieId={halbserieId}
              spieler={spielerOpts}
              teams={teamOpts}
            />
          </div>
        )}
      </main>
    </div>
  );
}
