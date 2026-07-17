"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function WillkommenButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function los() {
    setBusy(true);
    const supabase = createClient();
    await supabase.rpc("mark_onboarding_seen");
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      onClick={los}
      disabled={busy}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
    >
      {busy ? "…" : "Los geht's →"}
    </button>
  );
}
