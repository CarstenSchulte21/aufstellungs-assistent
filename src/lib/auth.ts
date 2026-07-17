import { createClient } from "@/lib/supabase/server";

export type SessionInfo = {
  userId: string;
  spielerId: string | null;
  rollen: string[];
  mfTeams: string[];
  isAdmin: boolean;
  isMf: boolean;
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

  return {
    userId: user.id,
    spielerId,
    rollen,
    mfTeams,
    isAdmin: rollen.includes("admin"),
    isMf: mfTeams.length > 0,
  };
}
