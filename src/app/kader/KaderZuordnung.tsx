"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type FavoritRow = {
  id: string;
  name: string;
  qttr: number;
  meldungTeamName: string;
};

export type KandidatRow = {
  id: string;
  name: string;
  meldungTeamName: string;
  stammTeamName: string;
};

export default function KaderZuordnung({
  halbserieId,
  teamId,
  teamName,
  isAdmin,
  favoriten,
  kandidaten,
}: {
  halbserieId: string;
  teamId: string;
  teamName: string;
  isAdmin: boolean;
  favoriten: FavoritRow[];
  kandidaten: KandidatRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [favWahl, setFavWahl] = useState("");
  const [stammWahl, setStammWahl] = useState("");
  const [favImAlt, setFavImAlt] = useState(true);

  async function addFavorit() {
    if (!favWahl) return;
    setBusy("fav");
    setFehler(null);
    const { error } = await supabase.from("kader_zuordnung").insert({
      halbserie_id: halbserieId,
      mannschaft_id: teamId,
      spieler_id: favWahl,
      rolle: "favorit",
    });
    setBusy(null);
    if (error) setFehler(error.message);
    else {
      setFavWahl("");
      router.refresh();
    }
  }

  async function removeFavorit(spielerId: string) {
    setBusy("rm:" + spielerId);
    setFehler(null);
    const { error } = await supabase
      .from("kader_zuordnung")
      .delete()
      .eq("halbserie_id", halbserieId)
      .eq("mannschaft_id", teamId)
      .eq("spieler_id", spielerId)
      .eq("rolle", "favorit");
    setBusy(null);
    if (error) setFehler(error.message);
    else router.refresh();
  }

  async function holeStamm() {
    if (!stammWahl) return;
    setBusy("stamm");
    setFehler(null);
    const { error } = await supabase.rpc("set_spieler_stamm", {
      p_halbserie: halbserieId,
      p_ziel_team: teamId,
      p_spieler: stammWahl,
      p_favorit_im_alt: favImAlt,
    });
    setBusy(null);
    if (error) setFehler(error.message);
    else {
      setStammWahl("");
      router.refresh();
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Favoriten */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-[14px] font-bold text-slate-800">
          Favoriten ({favoriten.length})
        </h2>
        <p className="mb-3 text-[12px] text-slate-500">
          Zusätzliche Spieler, die für {teamName || "diese Mannschaft"} wichtig
          sind. Sie werden hier angezeigt und können pro Spieltag gezielt
          angefragt werden — aber nicht automatisch.
        </p>

        {favoriten.length > 0 && (
          <div className="mb-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
            {favoriten.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2">
                <div className="mr-auto text-sm">
                  <span className="font-medium text-slate-800">{f.name}</span>
                  {f.meldungTeamName && (
                    <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      gemeldet in {f.meldungTeamName}
                    </span>
                  )}
                  <span className="ml-2 text-[12px] text-slate-400">
                    QTTR {f.qttr}
                  </span>
                </div>
                <button
                  onClick={() => removeFavorit(f.id)}
                  disabled={busy === "rm:" + f.id}
                  className="text-[13px] font-medium text-rose-600 hover:underline disabled:opacity-50"
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={favWahl}
            onChange={(e) => setFavWahl(e.target.value)}
            className="min-w-[200px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">— Spieler wählen —</option>
            {kandidaten.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
                {k.stammTeamName ? ` (Stamm ${k.stammTeamName})` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={addFavorit}
            disabled={!favWahl || busy === "fav"}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {busy === "fav" ? "…" : "Als Favorit hinzufügen"}
          </button>
        </div>
      </section>

      {/* Stamm holen — nur Admin */}
      {isAdmin && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-[14px] font-bold text-slate-800">
            Stamm holen (Admin)
          </h2>
          <p className="mb-3 text-[12px] text-slate-500">
            Verschiebt den Stammplatz eines Spielers zu{" "}
            {teamName || "dieser Mannschaft"}. Sein bisheriger Stamm-Platz wird
            aufgelöst. Die offizielle Meldung bleibt unberührt.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={stammWahl}
              onChange={(e) => setStammWahl(e.target.value)}
              className="min-w-[200px] rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">— Spieler wählen —</option>
              {kandidaten.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                  {k.stammTeamName ? ` (Stamm ${k.stammTeamName})` : ""}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[12px] text-slate-600">
              <input
                type="checkbox"
                checked={favImAlt}
                onChange={(e) => setFavImAlt(e.target.checked)}
              />
              als Favorit im alten Team behalten
            </label>
            <button
              onClick={holeStamm}
              disabled={!stammWahl || busy === "stamm"}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {busy === "stamm" ? "…" : "Stamm hierher holen"}
            </button>
          </div>
        </section>
      )}

      {fehler && (
        <p className="text-[13px] text-rose-600">Fehler: {fehler}</p>
      )}
    </div>
  );
}
