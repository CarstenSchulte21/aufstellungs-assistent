import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import PasswortForm from "./PasswortForm";

export const dynamic = "force-dynamic";

export default async function KontoPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <h1 className="mb-1 text-[15px] font-bold text-slate-800">Mein Konto</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          Angemeldet als {user?.email}. Hier kannst du dein Passwort setzen oder
          ändern — das wirkt sofort, ohne E-Mail.
        </p>
        <PasswortForm />
      </main>
    </div>
  );
}
