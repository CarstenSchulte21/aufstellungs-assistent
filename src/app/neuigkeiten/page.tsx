import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import { fuerRollen, rollenVon } from "@/lib/neuigkeiten";

export const dynamic = "force-dynamic";

function fmt(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function NeuigkeitenPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const items = fuerRollen(
    rollenVon({ realIsMf: session.realIsMf, realIsAdmin: session.realIsAdmin })
  );

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
      <main className="mx-auto max-w-2xl px-4 py-5">
        <h1 className="mb-1 text-lg font-bold text-slate-900">Neuigkeiten</h1>
        <p className="mb-4 text-[13px] text-slate-500">
          Was zuletzt im Aufstellungs-Assistenten dazugekommen ist.
        </p>

        {items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Momentan gibt es keine Neuigkeiten.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((n) => (
              <li
                key={n.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {fmt(n.datum)}
                </div>
                <div className="text-[15px] font-bold text-slate-800">
                  {n.titel}
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                  {n.text}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
