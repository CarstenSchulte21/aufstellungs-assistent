import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import KoppelnClient, { type KoppelSpieler } from "./KoppelnClient";

export const dynamic = "force-dynamic";

export default async function KoppelnPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin && !session.isMf) redirect("/");

  const supabase = createClient();
  const { data: hs } = await supabase
    .from("halbserien")
    .select("id")
    .eq("aktiv", true)
    .maybeSingle();

  const { data: meld } = await supabase
    .from("meldungen")
    .select(
      "position, spieler:spieler_id(id, name, telegram_chat_id), mannschaften:mannschaft_id(nummer, name)"
    )
    .eq("halbserie_id", hs?.id ?? "")
    .order("position", { ascending: true });

  const spieler: KoppelSpieler[] = (meld ?? [])
    .map((m: any) => ({
      id: m.spieler?.id,
      name: m.spieler?.name ?? "—",
      teamNummer: m.mannschaften?.nummer ?? 0,
      teamName: m.mannschaften?.name ?? "",
      gekoppelt: !!m.spieler?.telegram_chat_id,
    }))
    .filter((s: KoppelSpieler) => s.id)
    .sort((a: KoppelSpieler, b: KoppelSpieler) =>
      a.teamNummer - b.teamNummer || a.name.localeCompare(b.name)
    );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <a href="/" className="text-blue-100 hover:text-white">
            ←
          </a>
          <div className="mr-auto text-[15px] font-bold">Telegram-Kopplung</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">
        <p className="mb-4 text-sm text-slate-600">
          Erzeuge für einen Spieler einen persönlichen Verbindungs-Link. Der
          Spieler öffnet ihn (oder du selbst zum Testen), tippt in Telegram auf
          „Start“ — danach kannst du eine Testabfrage schicken.
        </p>
        <KoppelnClient spieler={spieler} />
      </main>
    </div>
  );
}
