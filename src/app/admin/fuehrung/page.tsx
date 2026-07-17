import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import FuehrungClient, { type TeamFuehrung, type Kandidat } from "./FuehrungClient";

export const dynamic = "force-dynamic";

export default async function FuehrungPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin) redirect("/");

  const supabase = createClient();
  const { data: hs } = await supabase
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();

  const { data: teams } = await supabase
    .from("mannschaften")
    .select("id, nummer, name, mannschaftsfuehrer_id, stellv_mf_id")
    .order("nummer");

  // Mannschafts-Zuordnung je Spieler (nur als Hinweis im Dropdown)
  const { data: meld } = await supabase
    .from("meldungen")
    .select("spieler_id, mannschaften:mannschaft_id(nummer)")
    .eq("halbserie_id", hs?.id ?? "");
  const teamVon = new Map<string, number>();
  for (const m of meld ?? [])
    teamVon.set((m as any).spieler_id, (m as any).mannschaften?.nummer ?? 0);

  // Auswahl: ALLE Spieler (keine Einschränkung auf die eigene Mannschaft)
  const { data: spieler } = await supabase
    .from("spieler")
    .select("id, name")
    .order("name");
  const alle: Kandidat[] = (spieler ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    team: teamVon.get(s.id) ?? null,
  }));

  const rows: TeamFuehrung[] = (teams ?? []).map((t: any) => ({
    id: t.id,
    nummer: t.nummer,
    name: t.name,
    mf_id: t.mannschaftsfuehrer_id,
    stellv_id: t.stellv_mf_id,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <a href="/admin" className="text-blue-100 hover:text-white">
            ←
          </a>
          <div className="mr-auto text-[15px] font-bold">Mannschaftsführung</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">
        <p className="mb-4 text-sm text-slate-600">
          Lege pro Mannschaft den Mannschaftsführer und optional einen
          Stellvertreter fest. Beide erhalten Schreibrechte und die eigene
          Mannschafts-Sicht — sobald ihr Login mit dem Spieler verknüpft ist
          (gleiche E-Mail beim ersten Login).
        </p>
        <FuehrungClient teams={rows} alle={alle} />
      </main>
    </div>
  );
}
