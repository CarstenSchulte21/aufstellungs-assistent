import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import SpielplanClient, { type SpielRow, type TeamOpt } from "./SpielplanClient";

export const dynamic = "force-dynamic";

export default async function SpielplanPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin) redirect("/");

  const supabase = createClient();
  const { data: hs } = await supabase
    .from("halbserien")
    .select("id, bezeichnung")
    .eq("aktiv", true)
    .maybeSingle();
  const halbserieId = hs?.id ?? "";

  const { data: teams } = await supabase
    .from("mannschaften")
    .select("id, nummer, name")
    .order("nummer");

  const { data: spiele } = await supabase
    .from("spiele")
    .select(
      "id, mannschaft_id, spieltag_nr, datum, uhrzeit, heim, gegner, ort, status"
    )
    .eq("halbserie_id", halbserieId)
    .order("datum");

  const rows: SpielRow[] = (spiele ?? []).map((s: any) => ({
    id: s.id,
    mannschaft_id: s.mannschaft_id,
    spieltag_nr: s.spieltag_nr,
    datum: s.datum,
    uhrzeit: s.uhrzeit ? s.uhrzeit.slice(0, 5) : "",
    heim: s.heim,
    gegner: s.gegner,
    ort: s.ort ?? "",
    status: s.status,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <a href="/admin" className="text-blue-100 hover:text-white">
            ←
          </a>
          <div className="mr-auto text-[15px] font-bold">Spielplan-Verwaltung</div>
          <span className="text-[12px] text-blue-200">{hs?.bezeichnung}</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">
        <SpielplanClient
          halbserieId={halbserieId}
          teams={(teams ?? []) as TeamOpt[]}
          rows={rows}
        />
      </main>
    </div>
  );
}
