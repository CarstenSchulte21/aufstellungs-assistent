import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { ladeKandidaten } from "@/lib/engine/laden";
import type { Kandidat } from "@/lib/engine/kandidaten";
import S4Client, { type S4Player, type ErsatzAnfrage } from "./S4Client";

export const dynamic = "force-dynamic";

export default async function SpieltagPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = createClient();
  const { data: spiel } = await supabase
    .from("spiele")
    .select(
      "id, spieltag_nr, datum, uhrzeit, heim, gegner, mannschaft_id, halbserie_id, mannschaften:mannschaft_id(name, spielstaerke)"
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!spiel) notFound();

  const need = (spiel as any).mannschaften?.spielstaerke ?? 0;
  const teamName = (spiel as any).mannschaften?.name ?? "Mannschaft";
  const istMf =
    session.isAdmin || session.mfTeams.includes((spiel as any).mannschaft_id);

  // Kader
  const { data: meld } = await supabase
    .from("meldungen")
    .select("position, spieler:spieler_id(id, name)")
    .eq("mannschaft_id", (spiel as any).mannschaft_id)
    .eq("halbserie_id", (spiel as any).halbserie_id)
    .order("position");
  const { data: kader } = await supabase
    .from("kader_status")
    .select("spieler_id, status")
    .eq("halbserie_id", (spiel as any).halbserie_id);
  const kaderMap = new Map((kader ?? []).map((k: any) => [k.spieler_id, k.status]));

  const { data: verf } = await supabase
    .from("v_verfuegbarkeiten")
    .select("spieler_id, status, kommentar")
    .eq("spiel_id", params.id);
  const vMap = new Map((verf ?? []).map((v: any) => [v.spieler_id, v]));

  const players: S4Player[] = (meld ?? []).map((m: any) => {
    const kaderStatus = kaderMap.get(m.spieler?.id) ?? "aktiv";
    const v = vMap.get(m.spieler?.id) as any;
    return {
      id: m.spieler?.id,
      name: m.spieler?.name ?? "—",
      position: m.position,
      kaderStatus,
      status: kaderStatus !== "aktiv" ? kaderStatus : v?.status ?? "nicht_angefragt",
      kommentar: v?.kommentar ?? null,
    };
  });

  const zu = players.filter((p) => p.status === "zugesagt").length;

  // Parallelspiele anderer Mannschaften am selben Tag
  const { data: parallel } = await supabase
    .from("spiele")
    .select("mannschaften:mannschaft_id(name)")
    .eq("datum", (spiel as any).datum)
    .neq("mannschaft_id", (spiel as any).mannschaft_id);
  const parallelTeams = Array.from(
    new Set((parallel ?? []).map((p: any) => p.mannschaften?.name).filter(Boolean))
  );

  // Ersatzvorschläge + laufende Anfragen (nur MF/Admin, nur bei Lücke)
  let kandidaten: Kandidat[] = [];
  let anfragen: ErsatzAnfrage[] = [];
  if (istMf) {
    const res = await ladeKandidaten(supabase, params.id);
    kandidaten = res?.kandidaten ?? [];
    const { data: an } = await supabase
      .from("ersatzanfragen")
      .select("id, spieler_id, status, frist_bis, spieler:spieler_id(name)")
      .eq("spiel_id", params.id)
      .order("freigegeben_am");
    anfragen = (an ?? []).map((a: any) => ({
      id: a.id,
      spieler_id: a.spieler_id,
      name: a.spieler?.name ?? "—",
      status: a.status,
      frist_bis: a.frist_bis,
    }));
  }

  return (
    <S4Client
      spiel={{
        id: (spiel as any).id,
        spieltag_nr: (spiel as any).spieltag_nr,
        datum: (spiel as any).datum,
        heim: (spiel as any).heim,
        gegner: (spiel as any).gegner,
        teamName,
        need,
      }}
      zu={zu}
      players={players}
      istMf={istMf}
      parallelTeams={parallelTeams as string[]}
      kandidaten={kandidaten}
      anfragen={anfragen}
    />
  );
}
