import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import StammdatenClient, {
  type SpielerRow,
  type TeamOpt,
  type MeldungRow,
} from "./StammdatenClient";

export const dynamic = "force-dynamic";

export default async function StammdatenPage() {
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

  const { data: spieler } = await supabase
    .from("spieler")
    .select("id, name, qttr, telefon, email, kanal, dsgvo_einwilligung_am")
    .order("qttr", { ascending: false })
    .order("name");

  const { data: teams } = await supabase
    .from("mannschaften")
    .select("id, nummer, name, spielstaerke")
    .order("nummer");

  const { data: meld } = await supabase
    .from("meldungen")
    .select("id, mannschaft_id, spieler_id, position, sperrvermerk, res")
    .eq("halbserie_id", halbserieId)
    .order("position");

  const spielerRows: SpielerRow[] = (spieler ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    qttr: s.qttr ?? 0,
    telefon: s.telefon ?? "",
    email: s.email ?? "",
    kanal: s.kanal ?? "telegram",
    dsgvo: !!s.dsgvo_einwilligung_am,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <a href="/admin" className="text-blue-100 hover:text-white">
            ←
          </a>
          <div className="mr-auto text-[15px] font-bold">
            Stammdaten &amp; Meldungen
          </div>
          <span className="text-[12px] text-blue-200">{hs?.bezeichnung}</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">
        <StammdatenClient
          halbserieId={halbserieId}
          spieler={spielerRows}
          teams={(teams ?? []) as TeamOpt[]}
          meldungen={(meld ?? []) as MeldungRow[]}
        />
      </main>
    </div>
  );
}
