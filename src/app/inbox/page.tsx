import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { loadInbox, type InboxItem } from "@/lib/inbox";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

function fmt(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

const TYP_UI: Record<InboxItem["typ"], { label: string; cls: string }> = {
  luecke: { label: "Lücke", cls: "bg-amber-100 text-amber-700" },
  einplanen: { label: "Einplanen", cls: "bg-emerald-100 text-emerald-700" },
  abgelaufen: { label: "Abgelaufen", cls: "bg-rose-100 text-rose-600" },
  keine_antwort: { label: "Keine Antwort", cls: "bg-slate-200 text-slate-600" },
  unsicher: { label: "Unsicher", cls: "bg-amber-50 text-amber-700" },
};

export default async function InboxPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin && !session.isMf) redirect("/");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const items = await loadInbox(supabase, {
    isAdmin: session.isAdmin,
    mfTeams: session.mfTeams,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        userEmail={user?.email ?? ""}
        isAdmin={session.isAdmin}
        isMf={session.isMf}
        realIsAdmin={session.realIsAdmin}
        realIsMf={session.realIsMf}
        hatManagement={session.hatManagement}
        spielerModus={session.spielerModus}
        inboxCount={items.length}
      />
      <main className="mx-auto max-w-3xl px-4 py-5">
        <h1 className="mb-1 text-[15px] font-bold text-slate-800">
          Offene Entscheidungen
        </h1>
        <p className="mb-4 text-[12px] text-slate-500">
          Alle Vorgänge, die deine Entscheidung brauchen. Klick öffnet den
          Spieltag zum Handeln.
        </p>

        {items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Nichts zu tun — alles im grünen Bereich. 👍
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it, i) => {
              const ui = TYP_UI[it.typ];
              return (
                <a
                  key={i}
                  href={`/spieltag/${it.spielId}`}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-primary"
                >
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${ui.cls}`}
                  >
                    {ui.label}
                  </span>
                  <div className="mr-auto">
                    <div className="text-sm font-medium text-slate-900">
                      {it.titel}
                    </div>
                    <div className="text-[12px] text-slate-500">{it.detail}</div>
                  </div>
                  <span className="text-[12px] text-slate-400">
                    {fmt(it.datum)}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
