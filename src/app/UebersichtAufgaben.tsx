import type { InboxItem } from "@/lib/inbox";
import type { SpielerAufgabe } from "@/lib/spielerinbox";
import type { SpielerInfo } from "@/lib/spielerinfos";

function fmt(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

const TYP_UI: Record<InboxItem["typ"], { label: string; cls: string }> = {
  luecke: { label: "Lücke", cls: "bg-amber-100 text-amber-700" },
  verlegung: { label: "Verlegung?", cls: "bg-rose-100 text-rose-700" },
  einplanen: { label: "Einplanen", cls: "bg-emerald-100 text-emerald-700" },
  abgelaufen: { label: "Abgelaufen", cls: "bg-rose-100 text-rose-600" },
  keine_antwort: { label: "Keine Antwort", cls: "bg-slate-200 text-slate-600" },
  unsicher: { label: "Unsicher", cls: "bg-amber-50 text-amber-700" },
  konflikt: { label: "Doppelzusage", cls: "bg-rose-100 text-rose-600" },
  nicht_angefragt: { label: "Nicht angefragt", cls: "bg-amber-50 text-amber-700" },
  kopplung: { label: "Kopplung", cls: "bg-blue-50 text-blue-700" },
  meldung: { label: "Kader", cls: "bg-slate-100 text-slate-600" },
};

const SPIELER_UI: Record<SpielerAufgabe["typ"], { label: string; cls: string }> = {
  verfuegbarkeit: { label: "Verfügbarkeit offen", cls: "bg-amber-100 text-amber-700" },
  unsicher: { label: "Unsicher", cls: "bg-amber-50 text-amber-700" },
  ersatz: { label: "Ersatzanfrage", cls: "bg-blue-50 text-blue-700" },
};

const INFO_UI: Record<SpielerInfo["typ"], { label: string; cls: string }> = {
  einsatz: { label: "Nächster Einsatz", cls: "bg-emerald-100 text-emerald-700" },
  eingeplant: { label: "Fest eingeplant", cls: "bg-emerald-50 text-emerald-700" },
  aenderung: { label: "Änderung", cls: "bg-amber-100 text-amber-700" },
  zurueckgezogen: { label: "Erledigt", cls: "bg-slate-100 text-slate-600" },
  abwesenheit: { label: "Abwesend", cls: "bg-slate-100 text-slate-600" },
  kopplung: { label: "Hinweis", cls: "bg-blue-50 text-blue-700" },
};

// Infos für Spieler: Dinge zum Wissen, keine To-dos.
export function SpielerInfoListe({ items }: { items: SpielerInfo[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-[15px] font-bold text-slate-800">
        Gut zu wissen
      </h2>
      <div className="space-y-2">
        {items.map((it, i) => {
          const ui = INFO_UI[it.typ];
          return (
            <div
              key={i}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
            >
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${ui.cls}`}
              >
                {ui.label}
              </span>
              <div className="mr-auto min-w-0">
                <div className="text-sm font-medium text-slate-900">
                  {it.titel}
                </div>
                <div className="text-[12px] text-slate-500">{it.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Aufgaben für Management (MF/Admin)
export function InboxAufgaben({ items }: { items: InboxItem[] }) {
  return (
    <section>
      <h2 className="mb-2 text-[15px] font-bold text-slate-800">
        Deine Aufgaben{items.length > 0 ? ` (${items.length})` : ""}
      </h2>
      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Nichts zu tun — alles im grünen Bereich. 👍
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => {
            const ui = TYP_UI[it.typ];
            const href = it.href ?? (it.spielId ? `/spieltag/${it.spielId}` : "/");
            return (
              <a
                key={i}
                href={href}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-primary"
              >
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${ui.cls}`}>
                  {ui.label}
                </span>
                <div className="mr-auto">
                  <div className="text-sm font-medium text-slate-900">{it.titel}</div>
                  <div className="text-[12px] text-slate-500">{it.detail}</div>
                </div>
                {it.datum && (
                  <span className="text-[12px] text-slate-400">{fmt(it.datum)}</span>
                )}
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}

// Aufgaben für Spieler
export function SpielerAufgabenListe({ items }: { items: SpielerAufgabe[] }) {
  return (
    <section>
      <h2 className="mb-2 text-[15px] font-bold text-slate-800">
        Deine Aufgaben{items.length > 0 ? ` (${items.length})` : ""}
      </h2>
      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
          Nichts offen — alles erledigt. 👍
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => {
            const ui = SPIELER_UI[it.typ];
            return (
              <a
                key={i}
                href={`/meine-spieltage${it.anker}`}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-primary"
              >
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${ui.cls}`}>
                  {ui.label}
                </span>
                <div className="mr-auto">
                  <div className="text-sm font-medium text-slate-900">{it.titel}</div>
                  <div className="text-[12px] text-slate-500">{it.detail}</div>
                </div>
                {it.datum && (
                  <span className="text-[12px] text-slate-400">{fmt(it.datum)}</span>
                )}
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
