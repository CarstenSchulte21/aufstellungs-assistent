import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import InfoContent from "@/components/InfoContent";

export const dynamic = "force-dynamic";

export default async function InfoPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rolle = session.isAdmin
    ? "admin"
    : session.isMf
    ? "mannschaftsfuehrer"
    : "spieler";

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
        <h1 className="mb-4 text-[15px] font-bold text-slate-800">
          Info &amp; Hilfe
        </h1>
        <InfoContent rolle={rolle} />
      </main>
    </div>
  );
}
