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
      "id, spieltag_nr, datum, uhrzeit, heim, gegner, mannschaft_id, halbserie_id, mannschaften:mannschaft_id(name, nummer, spielstaerke)"
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!spiel) notFound();

  const need = (spiel as any).mannschaften?.spielstaerke ?? 0;
  const teamName = (spiel as any).mannschaften?.name ?? "Mannschaft";
  const istMf =
    session.isAdmin || session.mfTeams.includes((spiel as any).mannschaft_id);

  // Kader: operativer Stamm (kader_zuordnung), nicht die Meldung
  const teamNummer = (spiel as any).mannschaften?.nummer ?? 0;
  const { data: stammZ } = await supabase
    .from("kader_zuordnung")
    .select("spieler_id")
    .eq("mannschaft_id", (spiel as any).mannschaft_id)
    .eq("halbserie_id", (spiel as any).halbserie_id)
    .eq("rolle", "stamm");
  const stammIds: string[] = (stammZ ?? []).map((z: any) => z.spieler_id);

  const { data: stammSp } = stammIds.length
    ? await supabase.from("spieler").select("id, name").in("id", stammIds)
    : { data: [] as any[] };
  const spName = new Map<string, string>(
    (stammSp ?? []).map((s: any) => [s.id as string, s.name as string])
  );

  const { data: meldRows } = stammIds.length
    ? await supabase
        .from("meldungen")
        .select("spieler_id, position, mannschaften:mannschaft_id(nummer)")
        .eq("halbserie_id", (spiel as any).halbserie_id)
        .in("spieler_id", stammIds)
    : { data: [] as any[] };
  const meldPos = new Map<string, { position: number; nummer: number }>(
    (meldRows ?? []).map((m: any) => [
      m.spieler_id,
      { position: m.position ?? 0, nummer: m.mannschaften?.nummer ?? 0 },
    ])
  );

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

  const players: S4Player[] = stammIds
    .map((id: string): S4Player => {
      const kaderStatus = (kaderMap.get(id) ?? "aktiv") as any;
      const v = vMap.get(id) as any;
      const mi = meldPos.get(id);
      const gemeldetHier = mi?.nummer === teamNummer;
      return {
        id,
        name: spName.get(id) ?? "—",
        position: gemeldetHier ? mi?.position ?? 0 : 900,
        kaderStatus,
        status:
          kaderStatus !== "aktiv" ? kaderStatus : v?.status ?? "nicht_angefragt",
        kommentar: v?.kommentar ?? null,
        ersatzHerkunft: mi && !gemeldetHier ? mi.nummer : null,
      };
    })
    .sort((a, b) => a.position - b.position);

  // Ersatzspieler: Verfügbarkeit für dieses Spiel, aber nicht in der Meldung
  const rosterIds = new Set(players.map((p) => p.id));
  const ersatzIds = (Array.from(vMap.keys()) as string[]).filter(
    (id) => !rosterIds.has(id)
  );
  if (ersatzIds.length > 0) {
    const { data: extra } = await supabase
      .from("meldungen")
      .select("spieler_id, mannschaften:mannschaft_id(nummer), spieler:spieler_id(name)")
      .eq("halbserie_id", (spiel as any).halbserie_id)
      .in("spieler_id", ersatzIds);
    for (const m of extra ?? []) {
      const v = vMap.get((m as any).spieler_id) as any;
      players.push({
        id: (m as any).spieler_id,
        name: (m as any).spieler?.name ?? "—",
        position: 900,
        kaderStatus: "aktiv",
        status: v?.status ?? "nicht_angefragt",
        kommentar: v?.kommentar ?? null,
        ersatzHerkunft: (m as any).mannschaften?.nummer ?? null,
      });
    }
  }

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
