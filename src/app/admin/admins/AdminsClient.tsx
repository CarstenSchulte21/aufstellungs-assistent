"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  istAdmin: boolean;
  istOwner: boolean;
};

export default function AdminsClient({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function toggle(u: UserRow, next: boolean) {
    setBusy(u.id);
    setMsg("");
    const { error } = await supabase.rpc("set_user_admin", {
      p_user: u.id,
      p_ist_admin: next,
    });
    setBusy(null);
    setMsg(
      error
        ? "Fehler: " + error.message
        : `${u.name || u.email}: Admin ${next ? "gesetzt" : "entfernt"} ✓`
    );
    router.refresh();
  }

  return (
    <div>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="mr-auto min-w-[180px]">
              <div className="text-sm font-medium text-slate-900">
                {u.name || "— (kein Spielerprofil)"}
                {u.istOwner && (
                  <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                    Besitzer
                  </span>
                )}
              </div>
              <div className="text-[12px] text-slate-500">{u.email}</div>
            </div>
            {u.istOwner ? (
              <span className="text-[12px] text-slate-400">
                Admin (fest)
              </span>
            ) : (
              <button
                onClick={() => toggle(u, !u.istAdmin)}
                disabled={busy === u.id}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                  u.istAdmin
                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                    : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
              >
                {busy === u.id ? "…" : u.istAdmin ? "Admin ✓" : "Zum Admin machen"}
              </button>
            )}
          </div>
        ))}
        {users.length === 0 && (
          <p className="p-4 text-sm text-slate-500">
            Noch keine angemeldeten Nutzer.
          </p>
        )}
      </div>
      {msg && <p className="mt-3 text-[12px] text-slate-600">{msg}</p>}
    </div>
  );
}
