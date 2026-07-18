import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type SessionInfo = {
  userId: string;
  spielerId: string | null;
  rollen: string[];
  mfTeams: string[];
  isAdmin: boolean; // effektiv (nach Modus-Umschaltung)
  isMf: boolean; // effektiv
  realIsAdmin: boolean;
  realIsMf: boolean;
  isOwner: boolean; // Besitzer: darf Admin-Rechte vergeben
  hatManagement: boolean; // MF und/oder Admin -> Modus-Umschalter verfügbar
  modus: "admin" | "mf" | "spieler"; // aktiver Modus
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
    .select("spieler_id, rollen, ist_owner")
    .eq("id", user.id)
    .maybeSingle();
  const rollen: string[] = (profil?.rollen as string[] | null) ?? [];
  const spielerId = (profil?.spieler_id as string | null) ?? null;
  const isOwner = (profil?.ist_owner as boolean | null) ?? false;

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
  const hatManagement = realIsAdmin || realIsMf;

  // Modus (Admin/MF/Spieler) — nur zulässige Modi je nach echter Rolle.
  const wunsch = cookies().get("modus")?.value;
  const erlaubt = (m?: string) =>
    m === "spieler" || (m === "mf" && realIsMf) || (m === "admin" && realIsAdmin);
  const modus: "admin" | "mf" | "spieler" =
    wunsch && erlaubt(wunsch)
      ? (wunsch as "admin" | "mf" | "spieler")
      : realIsAdmin
      ? "admin"
      : realIsMf
      ? "mf"
      : "spieler";

  const isAdmin = modus === "admin";
  // Im Admin-Modus zählen ALLE Mannschaften als „geführt" – der Admin darf für
  // jedes Team handeln (Ersatz anfordern, freigeben, einplanen …).
  const isMf = modus === "mf" || modus === "admin";
  let effMfTeams: string[];
  if (modus === "spieler") {
    effMfTeams = [];
  } else if (modus === "admin") {
    const { data: alle } = await supabase.from("mannschaften").select("id");
    effMfTeams = (alle ?? []).map((m: any) => m.id);
  } else {
    effMfTeams = mfTeams;
  }

  return {
    userId: user.id,
    spielerId,
    rollen,
    mfTeams: effMfTeams,
    isAdmin,
    isMf,
    realIsAdmin,
    realIsMf,
    isOwner,
    hatManagement,
    modus,
  };
}
