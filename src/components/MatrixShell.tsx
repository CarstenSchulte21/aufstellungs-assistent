"use client";

import AppHeader from "@/components/AppHeader";
import MatrixTabelle from "@/components/MatrixTabelle";
import type { MatrixData, TeamRow } from "@/lib/matrix";

export default function MatrixShell({
  teams,
  matrix,
  selectedTeamId,
  userEmail,
  isAdmin = false,
  isMf = false,
  realIsAdmin = false,
  realIsMf = false,
  hatManagement = false,
  modus = "spieler",
  basePath = "/",
}: {
  teams: TeamRow[];
  matrix: MatrixData | null;
  selectedTeamId: string;
  userEmail: string;
  isAdmin?: boolean;
  isMf?: boolean;
  realIsAdmin?: boolean;
  realIsMf?: boolean;
  hatManagement?: boolean;
  modus?: "admin" | "mf" | "spieler";
  basePath?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <AppHeader
        userEmail={userEmail}
        isAdmin={isAdmin}
        isMf={isMf}
        realIsAdmin={realIsAdmin}
        realIsMf={realIsMf}
        hatManagement={hatManagement}
        modus={modus}
      />
      <main className="mx-auto max-w-6xl px-4 py-5">
        <MatrixTabelle
          teams={teams}
          matrix={matrix}
          selectedTeamId={selectedTeamId}
          isAdmin={isAdmin}
          isMf={isMf}
          basePath={basePath}
        />
      </main>
    </div>
  );
}
