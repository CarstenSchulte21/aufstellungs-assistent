"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Meldet jeden Seitenwechsel anonym an /api/track (nur Pfad; die Rolle ergänzt
// der Server aus der Session). Bewusst schlank und ohne Dritt-Dienste.
export default function SeitenTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    try {
      const body = JSON.stringify({ pfad: pathname });
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/track",
          new Blob([body], { type: "application/json" })
        );
      } else {
        void fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    } catch {
      /* Tracking ist optional */
    }
  }, [pathname]);

  return null;
}
