// Chamber 07 · Ministers track — map this country's ministries to portfolio
// types. A compound ministry ("Tourism, Civil Aviation and Investment") takes a
// primary portfolio and any number of secondary ones. The first mapping was
// made by name when migration 0028 ran; this is where a person corrects it.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { mapMinistryPortfolio, type BoardData } from "@/lib/personas/portfolio/studio.functions";
import { cn } from "@/lib/utils";

import { FIELD, MICRO } from "./labels";

export function MinistryMapping({ data, onChanged }: { data: BoardData; onChanged: () => void }) {
  const map = useServerFn(mapMinistryPortfolio);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const all = new Map<string, BoardData["unmapped"][number]>();
  for (const p of data.portfolios) for (const m of p.ministries) all.set(m.id, m);
  for (const m of data.unmapped) all.set(m.id, m);
  const ministries = [...all.values()].sort((a, b) => a.name.localeCompare(b.name));
  const options = data.portfolios.filter((p) => p.kind === "ministry");

  async function save(id: string, primary: string | null, secondary: string[]) {
    setSaving(id);
    setError(null);
    try {
      await map({ data: { ministryId: id, primary, secondary } });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  if (!ministries.length)
    return (
      <p className="text-sm text-ink-500">
        No ministries are recorded for {data.countryName} yet. They arrive with country onboarding
        (stage 05).
      </p>
    );

  return (
    <div>
      <p className="mb-3 max-w-2xl text-[12px] text-ink-700">
        Which portfolio type each ministry is. The regional profiles are grounded in every mapped
        ministry across the region; the country overlay reads this country's. The Office of the
        Prime Minister maps itself.
      </p>
      {error && (
        <p className="mb-3 border-l-2 border-signal-negative py-1 pl-3 text-sm text-signal-negative">
          {error}
        </p>
      )}
      <table className="w-full border-t border-line-200 text-sm">
        <thead>
          <tr className="text-left">
            {["Ministry", "Primary portfolio", "Also covers"].map((h) => (
              <th key={h} className={cn(MICRO, "border-b border-line-200 py-2 pr-4 font-normal")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ministries.map((m) => (
            <tr key={m.id} className="border-b border-line-200 align-top">
              <td className="py-2 pr-4 text-xs text-ink-950">{m.name}</td>
              <td className="py-2 pr-4">
                <select
                  className={cn(FIELD, "py-1 text-xs")}
                  value={m.portfolio_code ?? ""}
                  disabled={!data.capabilities.mapMinistries || saving === m.id}
                  onChange={(e) =>
                    save(
                      m.id,
                      e.target.value || null,
                      (m.secondary_portfolio_codes ?? []).filter((c) => c !== e.target.value),
                    )
                  }
                  aria-label={`Primary portfolio for ${m.name}`}
                >
                  <option value="">— not mapped —</option>
                  {data.portfolios
                    .filter((p) => p.kind !== "opposition")
                    .map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.label}
                      </option>
                    ))}
                </select>
              </td>
              <td className="py-2">
                <div className="flex flex-wrap gap-1">
                  {options
                    .filter((p) => p.code !== m.portfolio_code)
                    .map((p) => {
                      const on = (m.secondary_portfolio_codes ?? []).includes(p.code);
                      return (
                        <button
                          key={p.code}
                          type="button"
                          disabled={!data.capabilities.mapMinistries || saving === m.id}
                          onClick={() =>
                            save(
                              m.id,
                              m.portfolio_code,
                              on
                                ? m.secondary_portfolio_codes.filter((c) => c !== p.code)
                                : [...(m.secondary_portfolio_codes ?? []), p.code],
                            )
                          }
                          className={cn(
                            "border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]",
                            on
                              ? "border-ink-950 text-ink-950"
                              : "border-line-200 text-ink-400 hover:text-ink-700",
                          )}
                          title={p.label}
                          aria-pressed={on}
                        >
                          {p.code}
                        </button>
                      );
                    })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data.capabilities.mapMinistries && (
        <p className="mt-2 text-xs text-ink-500">
          Mapping is done by the country admin, a data steward or the Cabinet Secretary.
        </p>
      )}
    </div>
  );
}
