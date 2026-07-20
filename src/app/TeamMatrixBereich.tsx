"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MatrixTabelle from "@/components/MatrixTabelle";
import TeamSlider from "./TeamSlider";
import type { MatrixData, TeamRow } from "@/lib/matrix";

// Blättert clientseitig durch die Mannschaften: bereits geladene Matrizen
// kommen aus dem Cache (sofort), Nachbar-Mannschaften werden im Hintergrund
// vorgeladen. So wird beim Wechsel nicht die ganze Seite neu aufgebaut.
export default function TeamMatrixBereich({
  teams,
  initialMatrix,
  initialTeamId,
  ownTeamId,
}: {
  teams: TeamRow[];
  initialMatrix: MatrixData | null;
  initialTeamId: string;
  ownTeamId: string | null;
}) {
  const [teamId, setTeamId] = useState(initialTeamId);
  const [matrix, setMatrix] = useState<MatrixData | null>(initialMatrix);
  const [laedt, setLaedt] = useState(false);
  const cache = useRef<Record<string, MatrixData | null>>({
    [initialTeamId]: initialMatrix,
  });
  const aktuell = useRef(initialTeamId);

  const holen = useCallback(async (id: string) => {
    if (id in cache.current) return cache.current[id];
    const res = await fetch(`/api/matrix?team=${id}`);
    if (!res.ok) return null;
    const json = await res.json();
    cache.current[id] = (json.matrix ?? null) as MatrixData | null;
    return cache.current[id];
  }, []);

  const vorladen = useCallback(
    (id: string) => {
      const i = teams.findIndex((t) => t.id === id);
      [teams[i - 1], teams[i + 1]].forEach((t) => {
        if (t && !(t.id in cache.current)) void holen(t.id);
      });
    },
    [teams, holen]
  );

  async function wechsle(id: string) {
    setTeamId(id);
    aktuell.current = id;
    window.history.replaceState(
      null,
      "",
      id === ownTeamId ? "/" : `/?team=${id}`
    );
    if (id in cache.current) {
      setMatrix(cache.current[id]);
    } else {
      setLaedt(true);
      const m = await holen(id);
      if (aktuell.current === id) setMatrix(m);
      setLaedt(false);
    }
    vorladen(id);
  }

  // Nachbarn direkt nach dem ersten Rendern vorladen
  useEffect(() => {
    const t = setTimeout(() => vorladen(initialTeamId), 400);
    return () => clearTimeout(t);
  }, [initialTeamId, vorladen]);

  // Realtime: bei Änderungen den Cache verwerfen und die aktuelle Matrix neu holen
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("matrix-verfuegbarkeiten-bereich")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "verfuegbarkeiten" },
        async () => {
          cache.current = {};
          const m = await holen(aktuell.current);
          setMatrix(m);
          vorladen(aktuell.current);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [holen, vorladen]);

  return (
    <section>
      <TeamSlider
        teams={teams}
        selectedTeamId={teamId}
        ownTeamId={ownTeamId}
        onWechsel={wechsle}
      />
      <div className={laedt ? "opacity-60 transition-opacity" : ""}>
        <MatrixTabelle
          teams={teams}
          matrix={matrix}
          selectedTeamId={teamId}
          basePath="/"
          zeigeAuswahl={false}
          realtime={false}
        />
      </div>
    </section>
  );
}
