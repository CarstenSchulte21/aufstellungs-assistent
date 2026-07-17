import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bot } from "grammy";

/**
 * SPEC A.7 „Lock-Timeout": gesendete Ersatzanfragen, deren Frist abgelaufen ist,
 * auf 'abgelaufen' setzen (der Lock fällt) und die MF der Mannschaft
 * informieren. Der nächste Kandidat erscheint danach automatisch wieder als
 * Vorschlag. Wird sowohl vom eigenen Cron als auch vom täglichen Reminder-Lauf
 * aufgerufen.
 */
export async function pruefeLockTimeout(
  admin: SupabaseClient,
  bot: Bot
): Promise<number> {
  const jetzt = new Date().toISOString();
  const { data: faellig } = await admin
    .from("ersatzanfragen")
    .select("id, spiel_id, spieler_id, spieler:spieler_id(name)")
    .eq("status", "gesendet")
    .lt("frist_bis", jetzt);

  let abgelaufen = 0;
  for (const a of faellig ?? []) {
    await admin
      .from("ersatzanfragen")
      .update({ status: "abgelaufen" })
      .eq("id", (a as any).id);
    await admin.from("audit_log").insert({
      benutzer_id: null,
      aktion: "ersatz_abgelaufen",
      entitaet: "ersatzanfragen",
      entitaet_id: (a as any).id,
      details: { spiel_id: (a as any).spiel_id, spieler_id: (a as any).spieler_id },
    });

    try {
      const { data: spiel } = await admin
        .from("spiele")
        .select(
          "mannschaften:mannschaft_id(mannschaftsfuehrer_id, stellv_mf_id)"
        )
        .eq("id", (a as any).spiel_id)
        .maybeSingle();
      const mfIds = [
        (spiel as any)?.mannschaften?.mannschaftsfuehrer_id,
        (spiel as any)?.mannschaften?.stellv_mf_id,
      ].filter(Boolean);
      for (const mfSpielerId of mfIds) {
        const { data: mf } = await admin
          .from("spieler")
          .select("telegram_chat_id")
          .eq("id", mfSpielerId)
          .maybeSingle();
        if (mf?.telegram_chat_id) {
          await bot.api.sendMessage(
            Number(mf.telegram_chat_id),
            `⏰ Ersatzanfrage an ${
              (a as any).spieler?.name ?? "einen Spieler"
            } ist ohne Antwort abgelaufen. Du kannst den nächsten Kandidaten anfragen.`
          );
        }
      }
    } catch {
      // Benachrichtigung ist optional
    }
    abgelaufen++;
  }
  return abgelaufen;
}
