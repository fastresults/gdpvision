// Figure 4 — against your peers. The same configuration (conditions, chambers,
// stance) applied to each same-region economy, re-scaled by its own GDP and
// largest-sector share. It answers "is this figure large because we are
// large?": each panel shows uplift as a share of GDP against the ceiling.

import {
  STANCE_MULTIPLIER,
  UPLIFT_CEILING_PCT_OF_GDP,
  computeValue,
  formatUsd,
  type ValueInput,
} from "@/lib/calculator/model";
import type { CountryFacts } from "@/lib/calculator/facts.server";

import { Figure, Key, type BriefPalette } from "./shared";

export function peerRows(input: ValueInput, facts: CountryFacts | null, limit = 8) {
  if (!facts) return [];
  const self = computeValue(input);
  const rows = [
    { code: facts.code, name: facts.name, usd: self.upliftUsd, pp: self.upliftPpOfGdp, self: true },
    ...facts.peers.slice(0, limit).map((p) => {
      const r = computeValue({
        ...input,
        gdpUsd: p.gdpUsd,
        topSectorSharePct: p.topSectorSharePct ?? input.topSectorSharePct,
      });
      return { code: p.code, name: p.name, usd: r.upliftUsd, pp: r.upliftPpOfGdp, self: false };
    }),
  ];
  return rows.sort((a, b) => b.pp - a.pp);
}

export function Peers({
  input,
  facts,
  palette,
  n = 4,
}: {
  input: ValueInput;
  facts: CountryFacts | null;
  palette: BriefPalette;
  n?: number;
}) {
  const rows = peerRows(input, facts);
  const cap = UPLIFT_CEILING_PCT_OF_GDP * STANCE_MULTIPLIER[input.stance];
  const region = facts?.region && facts.region !== "reference" ? facts.region : "regional";

  return (
    <Figure
      n={n}
      title="Against your peers"
      caption={`The same conditions, chambers and stance applied to each ${region} economy on record, re-scaled by its own GDP and largest-sector share. Differences come from economic structure, not from different assumptions. The rule at the right of each panel is the ceiling (${cap.toFixed(2)}% of GDP).`}
      legend={
        <>
          <Key colour={palette.accent} label={facts?.name ?? "This country"} />
          <Key colour={palette.compare} label="Peer" />
        </>
      }
    >
      {rows.length <= 1 ? (
        <p className="text-[13px] text-ink-500">
          No same-region peers are on record for this economy.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          {rows.map((r) => (
            <div
              key={r.code}
              className="border-t pt-2"
              style={{ borderColor: r.self ? palette.accent : "var(--line-200, #D9D6CF)" }}
            >
              <div className="truncate text-[12.5px] text-ink-950" title={r.name}>
                {r.name}
                {r.self ? (
                  <span className="ml-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-500">
                    you
                  </span>
                ) : null}
              </div>
              <svg
                viewBox="0 0 100 10"
                preserveAspectRatio="none"
                className="mt-1.5 h-2.5 w-full"
                aria-hidden
              >
                <rect
                  x="0"
                  y="2"
                  width="100"
                  height="6"
                  fill="none"
                  stroke={palette.rule}
                  strokeWidth="0.6"
                />
                <rect
                  x="0"
                  y="2"
                  width={Math.min(100, (r.pp / cap) * 100)}
                  height="6"
                  fill={r.self ? palette.accent : palette.compare}
                />
                <line x1="99.6" x2="99.6" y1="0" y2="10" stroke={palette.ink} strokeWidth="0.8" />
              </svg>
              <div className="mt-1 flex items-baseline justify-between font-mono text-[10.5px] tabular-nums text-ink-700">
                <span>{r.pp.toFixed(2)} pp</span>
                <span>{formatUsd(r.usd)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Figure>
  );
}
