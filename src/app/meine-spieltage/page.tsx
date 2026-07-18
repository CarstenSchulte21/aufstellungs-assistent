import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import MeineSpieltageClient, {
  type SpieltagRow,
  type AbwRow,
  type ProxyOpt,
  type ErsatzRow,
} from "./MeineSpieltageClient";

export const dynamic = "force-dynamic";

export default async function MeineSpieltagePage({
  searchParams,
}: {
  searchParams: { fuer?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = createClient();

  // Wen kann ich eintragen? Mich selbst + Spieler, für die ich Proxy bin.
  const proxyOpts: ProxyOpt[] = [];
  if (session.spielerId) {
    const { data: self } = await supabase
      .from("spieler")
      .select("id, name")
      .eq("id", session.spielerId)
      .maybeSingle();
    if (self) proxyOpts.push({ id: self.id, name: self.name + " (ich)" });
    const { data: proxied } = await supabase
      .from("spieler")
      .select("id, name")
      .eq("proxy_spieler_id", session.spielerId);
    for (const p of proxied ?? [])
      proxyOpts.push({ id: (p as any).id, name: (p as any).name });
  }

  if (proxyOpts.length === 0) {
    return (
      <Shell>
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-800">
            Dein Account ist noch keinem Spieler zugeordnet.
          </p>
          <p className="mt-1">
            Sobald dein Mannschaftsführer dich verknüpft hat (oder du dich per
            E-Mail deines Spielerprofils anmeldest), erscheinen hier deine
            Spieltage.
          </p>
        </div>
      </Shell>
    );
  }

  const zielId =
    proxyOpts.find((o) => o.id === searchParams.fuer)?.id ?? proxyOpts[0].id;

  const { data: hs } = await supabase
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();
  const halbserieId = hs?.id ?? "";

  // Stamm-Mannschaft des Zielspielers (operative Ebene, nicht Meldung)
  const { data: stamm } = await supabase
    .from("kader_zuordnung")
    .select("mannschaft_id")
    .eq("spieler_id", zielId)
    .eq("halbserie_id", halbserieId)
    .eq("rolle", "stamm")
    .maybeSingle();

  let spieltage: SpieltagRow[] = [];
  if (stamm?.mannschaft_id) {
    const { data: spiele } = await supabase
      .from("spiele")
      .select("id, spieltag_nr, datum, heim, gegner")
      .eq("mannschaft_id", stamm.mannschaft_id)
      .eq("halbserie_id", halbserieId)
      .order("datum");
    const spielIds = (spiele ?? []).map((s: any) => s.id);
    const { data: verf } = spielIds.length
      ? await supabase
          .from("v_verfuegbarkeiten")
          .select("spiel_id, status, kommentar")
          .eq("spieler_id", zielId)
          .in("spiel_id", spielIds)
      : { data: [] as any[] };
    const vMap = new Map((verf ?? []).map((v: any) => [v.spiel_id, v]));
    spieltage = (spiele ?? []).map((s: any) => ({
      id: s.id,
      spieltag_nr: s.spieltag_nr,
      datum: s.datum,
      heim: s.heim,
      gegner: s.gegner,
      status: (vMap.get(s.id) as any)?.status ?? "nicht_angefragt",
      kommentar: (vMap.get(s.id) as any)?.kommentar ?? null,
    }));
  }

  const { data: abw } = await supabase
    .from("abwesenheiten")
    .select("id, von, bis, grund")
    .eq("spieler_id", zielId)
    .order("von");
  const abwesenheiten: AbwRow[] = (abw ?? []) as AbwRow[];

  // Ersatzanfragen an mich (für andere Mannschaften)
  const { data: ers } = await supabase
    .from("ersatzanfragen")
    .select(
      "id, status, frist_bis, spiel_datum, spiele:spiel_id(spieltag_nr, datum, heim, gegner, mannschaften:mannschaft_id(nummer, name))"
    )
    .eq("spieler_id", zielId)
    .in("status", ["freigegeben", "gesendet", "zugesagt", "abgelehnt", "eingeplant"])
    .order("spiel_datum", { ascending: true });
  const ersatzanfragen: ErsatzRow[] = (ers ?? []).map((a: any) => ({
    id: a.id,
    status: a.status,
    frist_bis: a.frist_bis,
    datum: a.spiele?.datum ?? a.spiel_datum,
    spieltag_nr: a.spiele?.spieltag_nr ?? 0,
    heim: a.spiele?.heim ?? true,
    gegner: a.spiele?.gegner ?? "",
    teamNummer: a.spiele?.mannschaften?.nummer ?? 0,
    teamName: a.spiele?.mannschaften?.name ?? "",
  }));

  return (
    <Shell>
      <MeineSpieltageClient
        zielId={zielId}
        proxyOpts={proxyOpts}
        spieltage={spieltage}
        abwesenheiten={abwesenheiten}
        ersatzanfragen={ersatzanfragen}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <a href="/" className="text-blue-100 hover:text-white">
            ←
          </a>
          <div className="mr-auto text-[15px] font-bold">Meine Spieltage</div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5">{children}</main>
    </div>
  );
}
