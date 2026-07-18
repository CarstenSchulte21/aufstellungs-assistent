"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type TeamOpt = { id: string; nummer: number; name: string };

export type KaderPlayer = {
  id: string;
  name: string;
  position: number;
  gemeldetHier: boolean;
  meldungTeamName: string;
  qttr: number;
  kanal: string;
  telefon: string;
  email: string;
  praeferenzen: Record<string, any>;
  proxy_spieler_id: string | null;
  status: "aktiv" | "pausiert" | "inaktiv";
  pausiert_bis: string | null;
  notiz: string;
  offeneAbfragen: number;
};

const STATUS = ["aktiv", "pausiert", "inaktiv"] as const;

export default function KaderClient({
  halbserieId,
  players,
  teamMembers,
}: {
  halbserieId: string;
  players: KaderPlayer[];
  teamMembers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [dialog, setDialog] = useState<{
    player: KaderPlayer;
    ziel: "pausiert" | "inaktiv";
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<Record<string, string>>({});

  async function setStatus(p: KaderPlayer, ziel: KaderPlayer["status"]) {
    if (ziel === p.status) return;
    if ((ziel === "pausiert" || ziel === "inaktiv") && p.offeneAbfragen > 0) {
      setDialog({ player: p, ziel });
      return;
    }
    await commitStatus(p.id, ziel, null);
  }

  async function commitStatus(
    spielerId: string,
    ziel: KaderPlayer["status"],
    pausiertBis: string | null
  ) {
    setBusy(spielerId);
    await supabase
      .from("kader_status")
      .update({ status: ziel, pausiert_bis: pausiertBis })
      .eq("halbserie_id", halbserieId)
      .eq("spieler_id", spielerId);
    setBusy(null);
    setDialog(null);
    router.refresh();
  }

  async function saveNotiz(p: KaderPlayer, notiz: string) {
    await supabase
      .from("kader_status")
      .update({ notiz })
      .eq("halbserie_id", halbserieId)
      .eq("spieler_id", p.id);
    setInfo((i) => ({ ...i, [p.id]: "Notiz gespeichert ✓" }));
  }

  async function saveStamm(p: KaderPlayer, patch: Partial<KaderPlayer>) {
    const kanal = patch.kanal ?? p.kanal;
    const praeferenzen = patch.praeferenzen ?? p.praeferenzen;
    const proxy = patch.proxy_spieler_id ?? p.proxy_spieler_id;
    const { error } = await supabase.rpc("mf_update_spieler", {
      p_spieler_id: p.id,
      p_kanal: kanal,
      p_praeferenzen: praeferenzen,
      p_telefon: patch.telefon ?? (p.telefon || null),
      p_email: patch.email ?? (p.email || null),
      p_proxy_spieler_id: kanal === "proxy" ? proxy : null,
    });
    setInfo((i) => ({
      ...i,
      [p.id]: error ? "Fehler: " + error.message : "Gespeichert ✓",
    }));
    router.refresh();
  }

  async function einladung(p: KaderPlayer) {
    setBusy(p.id + ":inv");
    const res = await fetch("/api/telegram/koppeln", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spieler_id: p.id }),
    });
    const json = await res.json();
    setBusy(null);
    if (res.ok) setLinks((l) => ({ ...l, [p.id]: json.link }));
    else setInfo((i) => ({ ...i, [p.id]: json.error || "Fehler" }));
  }

  const aktiv = players.filter((p) => p.status === "aktiv").length;

  return (
    <div>
      <div className="mb-1 text-[14px] font-bold text-slate-800">
        Stamm ({players.length})
      </div>
      <div className="mb-3 text-[13px] text-slate-500">
        {aktiv} aktiv. Stammspieler werden für Spieltage automatisch angefragt.
        Die Regel-Engine rechnet unabhängig davon auf der offiziellen Meldung.
      </div>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {players.map((p) => (
          <div key={p.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-5 text-right text-[12px] font-bold text-slate-300">
                {p.gemeldetHier ? p.position : "·"}
              </span>
              <div className="mr-auto min-w-[150px]">
                <div
                  className={`font-medium ${
                    p.status !== "aktiv" ? "text-slate-400" : "text-slate-900"
                  }`}
                >
                  {p.name}
                  {!p.gemeldetHier && p.meldungTeamName && (
                    <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      gemeldet in {p.meldungTeamName}
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-slate-500">
                  QTTR {p.qttr}
                  {p.offeneAbfragen > 0 && (
                    <span className="ml-2 text-amber-600">
                      {p.offeneAbfragen} offene Abfrage
                      {p.offeneAbfragen > 1 ? "n" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Status-Umschalter */}
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-[12px] font-semibold">
                {STATUS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(p, s)}
                    disabled={busy === p.id}
                    className={`rounded-md px-2.5 py-1 capitalize transition ${
                      p.status === s
                        ? s === "aktiv"
                          ? "bg-emerald-500 text-white"
                          : s === "pausiert"
                          ? "bg-amber-400 text-white"
                          : "bg-slate-500 text-white"
                        : "text-slate-500 hover:bg-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Detailzeile */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {/* Kanal + Proxy */}
              <label className="text-[12px] text-slate-600">
                Kanal
                <div className="mt-1 flex gap-2">
                  <select
                    defaultValue={p.kanal}
                    onChange={(e) => saveStamm(p, { kanal: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="telegram">Telegram</option>
                    <option value="webapp">Webapp</option>
                    <option value="proxy">Proxy</option>
                    <option value="email">E-Mail</option>
                  </select>
                  {p.kanal === "proxy" && (
                    <select
                      defaultValue={p.proxy_spieler_id ?? ""}
                      onChange={(e) =>
                        saveStamm(p, { proxy_spieler_id: e.target.value })
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="">— trägt ein —</option>
                      {teamMembers
                        .filter((m) => m.id !== p.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </label>

              {/* Präferenzen */}
              <div className="text-[12px] text-slate-600">
                Präferenzen
                <div className="mt-1 flex flex-col gap-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked={!!p.praeferenzen?.nur_heimspiele}
                      onChange={(e) =>
                        saveStamm(p, {
                          praeferenzen: {
                            ...p.praeferenzen,
                            nur_heimspiele: e.target.checked,
                          },
                        })
                      }
                    />
                    nur Heimspiele
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked={!!p.praeferenzen?.keine_doppeleinsaetze}
                      onChange={(e) =>
                        saveStamm(p, {
                          praeferenzen: {
                            ...p.praeferenzen,
                            keine_doppeleinsaetze: e.target.checked,
                          },
                        })
                      }
                    />
                    keine Doppeleinsätze
                  </label>
                </div>
              </div>

              {/* Notiz */}
              <label className="text-[12px] text-slate-600 sm:col-span-2">
                Notiz
                <input
                  type="text"
                  defaultValue={p.notiz}
                  placeholder="z. B. Knie-OP, zurück ca. Nov."
                  onBlur={(e) => saveNotiz(p, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => einladung(p)}
                disabled={busy === p.id + ":inv"}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-[13px] font-medium text-slate-700 hover:border-slate-400"
              >
                {busy === p.id + ":inv" ? "…" : "Einladung/Kopplung"}
              </button>
              {links[p.id] && (
                <a
                  href={links[p.id]}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-[12px] font-medium text-primary hover:underline"
                >
                  {links[p.id]}
                </a>
              )}
              {info[p.id] && (
                <span className="text-[12px] text-slate-500">{info[p.id]}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Konsequenz-Dialog */}
      {dialog && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              {dialog.player.name} auf „{dialog.ziel}“ setzen?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              <strong>{dialog.player.offeneAbfragen}</strong> offene Abfrage
              {dialog.player.offeneAbfragen > 1 ? "n werden" : " wird"}{" "}
              zurückgenommen, und ggf. offene Ersatzanfragen zurückgezogen.
              Betroffene Spieltage können dadurch unvollständig werden.
            </p>
            {dialog.ziel === "pausiert" && (
              <label className="mt-3 block text-[13px] text-slate-600">
                Voraussichtlich zurück ab (optional)
                <input
                  id="pausiert-bis"
                  type="date"
                  className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDialog(null)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById(
                    "pausiert-bis"
                  ) as HTMLInputElement | null;
                  commitStatus(
                    dialog.player.id,
                    dialog.ziel,
                    el?.value || null
                  );
                }}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                Fortfahren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
