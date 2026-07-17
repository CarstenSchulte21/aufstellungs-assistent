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

  const { data: meld } = await supabase
    .from("meldungen")
    .select("mannschaft_id, position, spieler:spieler_id(id, name)")
    .eq("halbserie_id", hs?.id ?? "")
    .order("position");

  const kaderVon = new Map<string, Kandidat[]>();
  for (const m of meld ?? []) {
    const arr = kaderVon.get((m as any).mannschaft_id) ?? [];
    arr.push({ id: (m as any).spieler?.id, name: (m as any).spieler?.name ?? "—" });
    kaderVon.set((m as any).mannschaft_id, arr);
  }

  const rows: TeamFuehrung[] = (teams ?? []).map((t: any) => ({
    id: t.id,
    nummer: t.nummer,
    name: t.name,
    mf_id: t.mannschaftsfuehrer_id,
    stellv_id: t.stellv_mf_id,
    kader: kaderVon.get(t.id) ?? [],
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
        <FuehrungClient teams={rows} />
      </main>
    </div>
  );
}
