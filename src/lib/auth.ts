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
    .select("spieler_id, rollen, mf_von_mannschaften")
    .eq("id", user.id)
    .maybeSingle();
  const rollen: string[] = (profil?.rollen as string[] | null) ?? [];
  return {
    userId: user.id,
    spielerId: (profil?.spieler_id as string | null) ?? null,
    rollen,
    mfTeams: (profil?.mf_von_mannschaften as string[] | null) ?? [],
    isAdmin: rollen.includes("admin"),
    isMf: rollen.includes("mannschaftsfuehrer"),
  };
}
