"use client";

import { useRouter } from "next/navigation";
import type { TeamRow } from "@/lib/matrix";

export default function TeamSlider({
  teams,
  selectedTeamId,
  ownTeamId,
  onWechsel,
}: {
  teams: TeamRow[]; // aufsteigend nach Nummer (1 = höchste)
  selectedTeamId: string;
  ownTeamId: string | null;
  onWechsel?: (id: string) => void;
}) {
  const router = useRouter();
  const wechsle = (id: string) =>
    onWechsel ? onWechsel(id) : router.push(`/?team=${id}`);
  const idx = teams.findIndex((t) => t.id === selectedTeamId);
  const hoeher = idx > 0 ? teams[idx - 1] : null; // links = nächsthöher
  const tiefer = idx < teams.length - 1 ? teams[idx + 1] : null; // rechts = nächsttiefer
  const aktuell = teams[idx];

  const btn =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-lg font-semibold text-slate-600 transition hover:border-slate-400 disabled:opacity-30";

  return (
    <div className="mb-3 flex items-center gap-3">
      <button
        onClick={() => hoeher && wechsle(hoeher.id)}
        disabled={!hoeher}
        aria-label="Nächsthöhere Mannschaft"
        title={hoeher ? hoeher.name : ""}
        className={btn}
      >
        ‹
      </button>

      <div className="mr-auto">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold text-slate-800">
            {aktuell?.name}
          </span>
          {aktuell?.id === ownTeamId && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
              deine Mannschaft
            </span>
          )}
        </div>
        {aktuell?.liga && (
          <div className="text-[11px] text-slate-400">{aktuell.liga}</div>
        )}
      </div>

      <button
        onClick={() => tiefer && wechsle(tiefer.id)}
        disabled={!tiefer}
        aria-label="Nächsttiefere Mannschaft"
        title={tiefer ? tiefer.name : ""}
        className={btn}
      >
        ›
      </button>
    </div>
  );
}
