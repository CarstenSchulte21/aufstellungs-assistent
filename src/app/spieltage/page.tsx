import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import SpieltageListe, { type Spiel } from "./SpieltageListe";

export const dynamic = "force-dynamic";

function berlinHeute(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function SpieltageUebersicht() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: hs } = await supabase
    .from("halbserien")
    .select("id, bezeichnung")
    .eq("aktiv", true)
    .maybeSingle();

  let spiele: Spiel[] = [];
  if (hs?.id) {
    const { data } = await supabase
      .from("spiele")
      .select(
        "id, datum, uhrzeit, heim, gegner, status, mannschaften:mannschaft_id(name, nummer)"
      )
      .eq("halbserie_id", hs.id)
      .order("datum", { ascending: true })
      .order("uhrzeit", { ascending: true });
    spiele = (data ?? []).map((s: any) => ({
      id: s.id,
      datum: s.datum,
      uhrzeit: s.uhrzeit ?? null,
      heim: s.heim,
      gegner: s.gegner,
      status: s.status,
      teamName: s.mannschaften?.name ?? "—",
      teamNummer: s.mannschaften?.nummer ?? 99,
    }));
    // Innerhalb einer KW: erst nach Tag, bei gleichem Tag nach Mannschaft
    // (1. Mannschaft zuerst), zuletzt nach Uhrzeit.
    spiele.sort(
      (a, b) =>
        a.datum.localeCompare(b.datum) ||
        a.teamNummer - b.teamNummer ||
        (a.uhrzeit ?? "").localeCompare(b.uhrzeit ?? "")
    );
  }

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
        spielerCount={0}
      />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <div className="mb-4">
          <h1 className="text-lg font-bold text-slate-900">Alle Spieltage</h1>
          <p className="text-[13px] text-slate-500">
            {hs?.bezeichnung ? `${hs.bezeichnung} · ` : ""}alle Mannschaften,
            nach Kalenderwoche
          </p>
        </div>

        <SpieltageListe spiele={spiele} heute={berlinHeute()} />
      </main>
    </div>
  );
}
