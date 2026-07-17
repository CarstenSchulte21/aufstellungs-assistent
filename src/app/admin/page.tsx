import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin) redirect("/");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <a href="/" className="text-blue-100 hover:text-white">
            ←
          </a>
          <div className="mr-auto text-[15px] font-bold">Verwaltung</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href="/admin/spielplan"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary"
          >
            <div className="text-base font-bold text-slate-900">
              📅 Spielplan
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Spiele aller Mannschaften anlegen, bearbeiten und Termine ändern.
            </p>
          </a>
          <a
            href="/admin/stammdaten"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary"
          >
            <div className="text-base font-bold text-slate-900">
              👥 Stammdaten &amp; Meldungen
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Spieler pflegen und die Mannschaftsmeldung (Positionen,
              Sperrvermerk, RES) erfassen.
            </p>
          </a>
          <a
            href="/admin/fuehrung"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary"
          >
            <div className="text-base font-bold text-slate-900">
              🧑‍🏫 Mannschaftsführung
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Mannschaftsführer und Stellvertreter je Mannschaft festlegen.
            </p>
          </a>
        </div>
        <p className="mt-6 text-[12px] text-slate-400">
          Diese Bereiche sind nur für Admins sichtbar.
        </p>
      </main>
    </div>
  );
}
