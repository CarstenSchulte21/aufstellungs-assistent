import type { SupabaseClient } from "@supabase/supabase-js";
import { heuteBerlin, plusTage } from "@/lib/cron";
import { ladeKandidaten } from "@/lib/engine/laden";

export type InboxItem = {
  typ:
    | "luecke"
    | "verlegung"
    | "einplanen"
    | "abgelaufen"
    | "keine_antwort"
    | "unsicher"
    | "konflikt"
    | "nicht_angefragt"
    | "kopplung"
    | "meldung";
  titel: string;
  detail: string;
  datum: string;
  teamName: string;
  spielId?: string;
  href?: string;
  ersatzanfrageId?: string;
};

// Maximale Anzahl Engine-Prüfungen für „Lücke ohne Kandidaten" (Performance).
const MAX_KANDIDATEN_CHECKS = 12;

export async function loadInbox(
  supabase: SupabaseClient,
  opts: { isAdmin: boolean; mfTeams: string[]; schnell?: boolean }
): Promise<InboxItem[]> {
  const heute = heuteBerlin();
  const { data: hs } = await supabase
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();
  const halbserieId = hs?.id ?? "";

  const { data: teams } = await supabase
    .from("mannschaften")
    .select("id, name, spielstaerke");
  const nameVon = new Map<string, string>();
  const staerkeVon = new Map<string, number>();
  for (const t of teams ?? []) {
    nameVon.set((t as any).id, (t as any).name);
    staerkeVon.set((t as any).id, (t as any).spielstaerke);
  }
  const meineTeamIds = opts.isAdmin ? Array.from(nameVon.keys()) : opts.mfTeams;
  if (meineTeamIds.length === 0) return [];

  // Vorlauf je Mannschaft (für „noch nicht angefragt")
  const { data: cfgRows } = await supabase
    .from("regel_config")
    .select("mannschaft_id, config")
    .eq("halbserie_id", halbserieId);
  const vorlaufVon = new Map<string, number>();
  for (const r of cfgRows ?? [])
    vorlaufVon.set(
      (r as any).mannschaft_id,
      Number((r as any).config?.vorlauf_erstabfrage_tage ?? 28)
    );

  // Operativer Stamm je Mannschaft (aktiv + Kopplung) — nicht die Meldung
  const { data: stamm } = await supabase
    .from("kader_zuordnung")
    .select("spieler_id, mannschaft_id, spieler:spieler_id(telegram_chat_id)")
    .eq("halbserie_id", halbserieId)
    .eq("rolle", "stamm")
    .in("mannschaft_id", meineTeamIds);
  const { data: kader } = await supabase
    .from("kader_status")
    .select("spieler_id, status")
    .eq("halbserie_id", halbserieId);
  const kaderStatus = new Map<string, string>(
    (kader ?? []).map((k: any) => [k.spieler_id, k.status])
  );
  const aktivCountVon = new Map<string, number>();
  const ohneKopplungVon = new Map<string, number>();
  for (const m of stamm ?? []) {
    const aktiv = (kaderStatus.get((m as any).spieler_id) ?? "aktiv") === "aktiv";
    if (!aktiv) continue;
    const tid = (m as any).mannschaft_id;
    aktivCountVon.set(tid, (aktivCountVon.get(tid) ?? 0) + 1);
    if (!(m as any).spieler?.telegram_chat_id)
      ohneKopplungVon.set(tid, (ohneKopplungVon.get(tid) ?? 0) + 1);
  }

  const { data: spiele } = await supabase
    .from("spiele")
    .select("id, datum, heim, gegner, mannschaft_id")
    .eq("halbserie_id", halbserieId)
    .in("mannschaft_id", meineTeamIds)
    .gte("datum", heute)
    .order("datum", { ascending: true });
  const spielIds = (spiele ?? []).map((s: any) => s.id);
  const spielById = new Map<string, any>((spiele ?? []).map((s: any) => [s.id, s]));

  const zuVon = new Map<string, number>();
  const kaVon = new Map<string, number>();
  const unVon = new Map<string, number>();
  const angefasstVon = new Map<string, number>();
  if (spielIds.length > 0) {
    const { data: verf } = await supabase
      .from("verfuegbarkeiten")
      .select("spiel_id, spieler_id, status")
      .in("spiel_id", spielIds);
    for (const v of verf ?? []) {
      const id = (v as any).spiel_id;
      const st = (v as any).status;
      if (st === "zugesagt") zuVon.set(id, (zuVon.get(id) ?? 0) + 1);
      else if (st === "keine_antwort") kaVon.set(id, (kaVon.get(id) ?? 0) + 1);
      else if (st === "unsicher") unVon.set(id, (unVon.get(id) ?? 0) + 1);
      if (st !== "nicht_angefragt")
        angefasstVon.set(id, (angefasstVon.get(id) ?? 0) + 1);
    }
  }

  const spielItems: InboxItem[] = [];
  let checksLeft = MAX_KANDIDATEN_CHECKS;

  for (const s of spiele ?? []) {
    const teamName = nameVon.get((s as any).mannschaft_id) ?? "";
    const benoetigt = staerkeVon.get((s as any).mannschaft_id) ?? 0;
    const zu = zuVon.get((s as any).id) ?? 0;
    const gemein = { datum: (s as any).datum, teamName, spielId: (s as any).id };

    if (zu < benoetigt) {
      // Gibt es überhaupt noch Ersatzkandidaten? (begrenzt geprüft)
      let keineKandidaten = false;
      if (!opts.schnell && checksLeft > 0 && (s as any).datum <= plusTage(heute, 28)) {
        checksLeft--;
        const res = await ladeKandidaten(supabase, (s as any).id);
        keineKandidaten =
          (res?.kandidaten.filter((k) => !k.locked).length ?? 0) === 0;
      }
      if (keineKandidaten) {
        spielItems.push({
          typ: "verlegung",
          titel: `Lücke ohne Ersatz – Verlegung erwägen`,
          detail: `${teamName} · gegen ${(s as any).gegner} (${zu}/${benoetigt}) — kein zulässiger Ersatz verfügbar.`,
          ...gemein,
        });
      } else {
        spielItems.push({
          typ: "luecke",
          titel: `${benoetigt - zu} Lücke${benoetigt - zu > 1 ? "n" : ""}`,
          detail: `${teamName} · ${(s as any).heim ? "Heim" : "Auswärts"} gegen ${
            (s as any).gegner
          } (${zu}/${benoetigt}) — Ersatz suchen.`,
          ...gemein,
        });
      }
    }

    const ka = kaVon.get((s as any).id) ?? 0;
    if (ka > 0)
      spielItems.push({
        typ: "keine_antwort",
        titel: `${ka}× keine Antwort`,
        detail: `${teamName} gegen ${(s as any).gegner} — erneut anfragen oder manuell setzen`,
        ...gemein,
      });
    const un = unVon.get((s as any).id) ?? 0;
    if (un > 0)
      spielItems.push({
        typ: "unsicher",
        titel: `${un} unsichere Zusage${un > 1 ? "n" : ""}`,
        detail: `${teamName} gegen ${(s as any).gegner} — nachfassen`,
        ...gemein,
      });

    // Noch nicht angefragt (innerhalb des Vorlaufs)
    const vorlauf = vorlaufVon.get((s as any).mannschaft_id) ?? 28;
    if ((s as any).datum <= plusTage(heute, vorlauf)) {
      const aktiv = aktivCountVon.get((s as any).mannschaft_id) ?? 0;
      const angefasst = angefasstVon.get((s as any).id) ?? 0;
      const offen = aktiv - angefasst;
      if (offen > 0)
        spielItems.push({
          typ: "nicht_angefragt",
          titel: `${offen} noch nicht angefragt`,
          detail: `${teamName} gegen ${(s as any).gegner} — Erstabfrage anstoßen`,
          ...gemein,
        });
    }
  }

  // Ersatzanfragen (Einplanen / abgelaufen)
  const { data: ers } = await supabase
    .from("ersatzanfragen")
    .select("id, spiel_id, status, spieler:spieler_id(name)")
    .in("spiel_id", spielIds.length ? spielIds : ["00000000-0000-0000-0000-000000000000"])
    .in("status", ["zugesagt", "abgelaufen"]);
  for (const a of ers ?? []) {
    const s = spielById.get((a as any).spiel_id);
    if (!s) continue;
    const teamName = nameVon.get(s.mannschaft_id) ?? "";
    if ((a as any).status === "zugesagt")
      spielItems.push({
        typ: "einplanen",
        titel: `${(a as any).spieler?.name ?? "Ersatz"} hat zugesagt`,
        detail: `${teamName} gegen ${s.gegner} — final einplanen`,
        datum: s.datum,
        teamName,
        spielId: s.id,
        ersatzanfrageId: (a as any).id,
      });
    else
      spielItems.push({
        typ: "abgelaufen",
        titel: `Anfrage an ${(a as any).spieler?.name ?? "Ersatz"} abgelaufen`,
        detail: `${teamName} gegen ${s.gegner} — nächsten Kandidaten anfragen`,
        datum: s.datum,
        teamName,
        spielId: s.id,
        ersatzanfrageId: (a as any).id,
      });
  }

  // Doppelzusagen, die eine meiner Mannschaften betreffen
  if (spielIds.length > 0) {
    const { data: meineZus } = await supabase
      .from("verfuegbarkeiten")
      .select("spiel_id, spieler_id")
      .in("spiel_id", spielIds)
      .eq("status", "zugesagt");
    const meineZusList = (meineZus ?? [])
      .map((v: any) => ({ spieler_id: v.spieler_id, spiel: spielById.get(v.spiel_id) }))
      .filter((x: any) => x.spiel);
    const dates = Array.from(new Set(meineZusList.map((x: any) => x.spiel.datum)));
    if (dates.length > 0) {
      const { data: tagSpiele } = await supabase
        .from("spiele")
        .select("id, datum, mannschaft_id")
        .eq("halbserie_id", halbserieId)
        .in("datum", dates as string[]);
      const teamVonSpiel = new Map<string, { datum: string; team: string }>(
        (tagSpiele ?? []).map((s: any) => [s.id, { datum: s.datum, team: s.mannschaft_id }])
      );
      const { data: tagZus } = await supabase
        .from("verfuegbarkeiten")
        .select("spiel_id, spieler_id")
        .in("spiel_id", (tagSpiele ?? []).map((s: any) => s.id))
        .eq("status", "zugesagt");
      const teamsProSpielerTag = new Map<string, Set<string>>();
      for (const v of tagZus ?? []) {
        const info = teamVonSpiel.get((v as any).spiel_id);
        if (!info) continue;
        const key = `${(v as any).spieler_id}|${info.datum}`;
        const set = teamsProSpielerTag.get(key) ?? new Set<string>();
        set.add(info.team);
        teamsProSpielerTag.set(key, set);
      }
      const konfliktIds = new Set<string>();
      const konflikte: {
        spieler_id: string;
        datum: string;
        spielId: string;
        teamId: string;
        andere: string[];
      }[] = [];
      const gesehen = new Set<string>();
      for (const z of meineZusList as any[]) {
        const key = `${z.spieler_id}|${z.spiel.datum}`;
        const set = teamsProSpielerTag.get(key);
        if (set && set.size >= 2) {
          const dedupe = `${z.spieler_id}|${z.spiel.id}`;
          if (gesehen.has(dedupe)) continue;
          gesehen.add(dedupe);
          konfliktIds.add(z.spieler_id);
          konflikte.push({
            spieler_id: z.spieler_id,
            datum: z.spiel.datum,
            spielId: z.spiel.id,
            teamId: z.spiel.mannschaft_id,
            andere: Array.from(set)
              .filter((t) => t !== z.spiel.mannschaft_id)
              .map((t) => nameVon.get(t) ?? ""),
          });
        }
      }
      const namen = new Map<string, string>();
      if (konfliktIds.size > 0) {
        const { data: sp } = await supabase
          .from("spieler")
          .select("id, name")
          .in("id", Array.from(konfliktIds));
        for (const s of sp ?? []) namen.set((s as any).id, (s as any).name);
      }
      for (const k of konflikte) {
        spielItems.push({
          typ: "konflikt",
          titel: `Doppelzusage: ${namen.get(k.spieler_id) ?? "Spieler"}`,
          detail: `${nameVon.get(k.teamId) ?? ""} — hat am selben Tag auch bei ${k.andere.join(
            ", "
          )} zugesagt. Bitte mit dem/den anderen MF klären.`,
          datum: k.datum,
          teamName: nameVon.get(k.teamId) ?? "",
          spielId: k.spielId,
        });
      }
    }
  }

  spielItems.sort((a, b) => a.datum.localeCompare(b.datum));

  // Mannschaftsbezogene To-Dos (ohne konkretes Spiel) ans Ende
  const teamItems: InboxItem[] = [];
  for (const tid of meineTeamIds) {
    const teamName = nameVon.get(tid) ?? "";
    const ohne = ohneKopplungVon.get(tid) ?? 0;
    if (ohne > 0)
      teamItems.push({
        typ: "kopplung",
        titel: `${ohne} Spieler ohne Telegram`,
        detail: `${teamName} — diese Spieler sind noch nicht gekoppelt und werden nicht automatisch angefragt.`,
        datum: "",
        teamName,
        href: `/kader?team=${tid}`,
      });
    const aktiv = aktivCountVon.get(tid) ?? 0;
    const benoetigt = staerkeVon.get(tid) ?? 0;
    if (aktiv < benoetigt)
      teamItems.push({
        typ: "meldung",
        titel: `Kader knapp: ${aktiv}/${benoetigt} aktiv`,
        detail: `${teamName} — weniger aktive Stammspieler als benötigt.`,
        datum: "",
        teamName,
        href: `/admin/stammdaten`,
      });
  }

  return [...spielItems, ...teamItems];
}
