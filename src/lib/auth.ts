import { createClient } from "@/lib/supabase/server";

export type SessionInfo = {
  userId: string;
  rollen: string[];
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
    .select("rollen")
    .eq("id", user.id)
    .maybeSingle();
  const rollen: string[] = (profil?.rollen as string[] | null) ?? [];
  return {
    userId: user.id,
    rollen,
    isAdmin: rollen.includes("admin"),
    isMf: rollen.includes("mannschaftsfuehrer"),
  };
}
