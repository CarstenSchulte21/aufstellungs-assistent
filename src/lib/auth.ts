import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type SessionInfo = {
  userId: string;
  spielerId: string | null;
  rollen: string[];
  mfTeams: string[];
  isAdmin: boolean; // effektiv (nach Vorschau-Umschaltung)
  isMf: boolean; // effektiv
  realIsAdmin: boolean; // tatsächliche Admin-Rolle
  viewAs: string | null; // aktive Vorschau-Rolle des Admins
};

/** Liest die aktuelle Session + Rollen (oder null, wenn nicht eingeloggt). */
export async function getSession(): Promise<SessionInfo | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profil } = await supabase
    .from("benutzer")
    .select("spieler_id, rollen")
    .eq("id", user.id)
    .maybeSingle();
  const rollen: string[] = (profil?.rollen as string[] | null) ?? [];
  const spielerId = (profil?.spieler_id as string | null) ?? null;

  // MF-Zugehörigkeit wird aus der Mannschaft abgeleitet (Führer/Stellvertreter)
  let mfTeams: string[] = [];
  if (spielerId) {
    const { data: mt } = await supabase
      .from("mannschaften")
      .select("id")
      .or(`mannschaftsfuehrer_id.eq.${spielerId},stellv_mf_id.eq.${spielerId}`);
    mfTeams = (mt ?? []).map((m: any) => m.id);
  }

  const realIsAdmin = rollen.includes("admin");
  const realIsMf = mfTeams.length > 0;

  // Vorschau-als-Rolle (nur ein echter Admin darf herunterschalten)
  const viewAsRaw = cookies().get("view_as")?.value ?? null;
  const viewAs =
    realIsAdmin && (viewAsRaw === "spieler" || viewAsRaw === "mannschaftsfuehrer")
      ? viewAsRaw
      : null;

  let isAdmin = realIsAdmin;
  let isMf = realIsMf;
  let effMfTeams = mfTeams;
  if (viewAs === "spieler") {
    isAdmin = false;
    isMf = false;
    effMfTeams = [];
  } else if (viewAs === "mannschaftsfuehrer") {
    isAdmin = false; // MF-Rechte/Teams bleiben wie tatsächlich
  }

  return {
    userId: user.id,
    spielerId,
    rollen,
    mfTeams: effMfTeams,
    isAdmin,
    isMf,
    realIsAdmin,
    viewAs,
  };
}
