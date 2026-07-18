import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAdmin } from "@/lib/supabase/admin";
import AdminsClient, { type UserRow } from "./AdminsClient";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isOwner) redirect("/");

  const admin = getAdmin();

  // Login-E-Mails (nur der Besitzer sieht diese Seite)
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const emailVon = new Map<string, string>(
    (list?.users ?? []).map((u: any) => [u.id, u.email ?? ""])
  );

  const { data: benutzer } = await admin
    .from("benutzer")
    .select("id, rollen, ist_owner, spieler:spieler_id(name)");

  const users: UserRow[] = ((benutzer ?? []) as any[])
    .map((b: any): UserRow => ({
      id: b.id,
      email: emailVon.get(b.id) ?? "",
      name: b.spieler?.name ?? "",
      istAdmin: Array.isArray(b.rollen) && b.rollen.includes("admin"),
      istOwner: !!b.ist_owner,
    }))
    .sort((a, b) => {
      if (a.istOwner !== b.istOwner) return a.istOwner ? -1 : 1;
      if (a.istAdmin !== b.istAdmin) return a.istAdmin ? -1 : 1;
      return (a.name || a.email).localeCompare(b.name || b.email);
    });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <a href="/admin" className="text-blue-100 hover:text-white">
            ←
          </a>
          <div className="mr-auto text-[15px] font-bold">Administratoren</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">
        <p className="mb-4 text-[13px] text-slate-600">
          Als Besitzer kannst du anderen angemeldeten Nutzern das Admin-Recht
          geben oder entziehen. Ein Admin hat volle Verwaltungsrechte, kann aber
          selbst <strong>keine</strong> weiteren Admins ernennen. Das
          Besitzer-Kennzeichen wird nur direkt in der Datenbank vergeben.
        </p>
        <AdminsClient users={users} />
      </main>
    </div>
  );
}
