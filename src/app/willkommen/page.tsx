import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import InfoContent from "@/components/InfoContent";
import WillkommenButton from "./WillkommenButton";

export const dynamic = "force-dynamic";

export default async function WillkommenPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rolle = session.isAdmin
    ? "admin"
    : session.isMf
    ? "mannschaftsfuehrer"
    : "spieler";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-lg">
            🏓
          </div>
          <div className="text-[15px] font-bold">Willkommen!</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="mb-4 text-sm text-slate-600">
          Schön, dass du dabei bist. Hier kurz, was du mit dem Aufstellungs-
          Assistenten machen kannst:
        </p>
        <InfoContent rolle={rolle} />
        <div className="mt-6">
          <WillkommenButton />
        </div>
      </main>
    </div>
  );
}
