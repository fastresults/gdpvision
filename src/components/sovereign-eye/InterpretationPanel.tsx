import { Pin, X } from "lucide-react";

import { Explain } from "@/components/explain/Explain";

import type { MapFeature } from "./RegionMap";

export function InterpretationPanel({ feature, pinned, onClose, onEvidence }: {
  feature: MapFeature | null;
  pinned: boolean;
  onClose?: () => void;
  onEvidence?: () => void;
}) {
  return (
    <section aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-500">
            {pinned ? <Pin size={11} aria-hidden /> : null}
            {pinned ? "Pinned · what this means" : "What this means"}
          </p>
          <h3 className="mt-1 font-serif text-xl text-ink-950">{feature?.title ?? "Read the map"}</h3>
        </div>
        {pinned ? (
          <button type="button" className="btn-ghost h-8 w-8 p-0" onClick={onClose} aria-label="Close pinned interpretation">
            <X size={14} aria-hidden />
          </button>
        ) : null}
      </div>

      {feature ? (
        <div className="mt-4 grid gap-4 text-xs leading-relaxed">
          <InterpretationRow label="Signal" value={feature.signal} />
          <InterpretationRow label="Current reading" value={`${feature.value}${feature.meta ? ` · ${feature.meta}` : ""}`} />
          <PeerRow feature={feature} />
          <InterpretationRow label="Trend" value={feature.trend} explain />
          <InterpretationRow label="Economic meaning" value={feature.impact} />
          <InterpretationRow label="Forecast" value={feature.forecast} explain />
          {feature.provenance ? <InterpretationRow label="Confidence & source" value={feature.provenance} /> : null}
        </div>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-ink-600">Hover or focus a map mark or legend item. Click or tap to keep its explanation here.</p>
      )}

      {feature && onEvidence && feature.kind !== "place" && feature.kind !== "legend" ? (
        <button type="button" className="btn-secondary mt-4 min-h-8 px-3 text-[10px]" onClick={onEvidence}>View supporting evidence</button>
      ) : null}
    </section>
  );
}

function InterpretationRow({ label, value, explain = false }: { label: string; value: string; explain?: boolean }) {
  return (
    <div className="border-t border-line-100 pt-3 first:border-t-0 first:pt-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">{label}</p>
      {explain ? (
        <Explain id="sovereign-eye.interpretation" ctx={{ label, value }} mark={false} className="mt-1 block text-ink-700">{value}</Explain>
      ) : <p className="mt-1 text-ink-700">{value}</p>}
    </div>
  );
}
const NO_PEER: Partial<Record<MapFeature["kind"], string>> = {
  ministry: "No peer comparison: ministry coverage describes accountability, not economic performance.",
  corpus: "No peer comparison: document volume is not an economic measure.",
  live: "No peer comparison: live conditions are operational context only.",
  legend: "For indicator marks, this row compares the country with every Caribbean peer that has comparable, current public data. It flags a gap only when it is statistically meaningful.",
};

function fmt2(n: number) {
  return Math.abs(n) >= 1000 ? Math.round(n).toLocaleString() : n.toFixed(2);
}

function PeerRow({ feature }: { feature: MapFeature }) {
  const peer = feature.peer;
  if (!peer) {
    const note = NO_PEER[feature.kind] ?? (feature.kind === "macro" ? "Peer comparison not yet computed for this indicator." : null);
    return note ? <InterpretationRow label="Versus the Caribbean" value={note} /> : null;
  }
  if (peer.n < 5) return <InterpretationRow label="Versus the Caribbean" value={`Not enough peer data to compare (${peer.n} countries).`} />;
  const span = peer.peerMax - peer.peerMin || 1;
  const x = (v: number) => 4 + ((v - peer.peerMin) / span) * 192;
  const tone = peer.favourable == null ? "text-ink-700" : peer.favourable ? "text-signal-positive" : "text-signal-negative";
  return (
    <div className="border-t border-line-100 pt-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">Versus the Caribbean</p>
      <Explain id="sovereign-eye.peer-gap" ctx={peer} mark={false} className="mt-1 block text-ink-700">
        {ordinal(peer.rank)} of {peer.n} · {Math.round(peer.percentile)}th percentile · peer median {fmt2(peer.median)} (range {fmt2(peer.peerMin)}–{fmt2(peer.peerMax)})
      </Explain>
      <p className={`mt-1 tabular-nums ${tone}`}>
        Gap {peer.gap >= 0 ? "+" : ""}{fmt2(peer.gap)}
        {peer.favourable == null ? "" : peer.favourable ? " · favourable" : " · unfavourable"}
        {" · "}{peer.meaningful ? <strong>Meaningful</strong> : <span className="text-ink-600">Within the normal Caribbean range</span>}
      </p>
      <svg viewBox="0 0 200 16" className="mt-2 h-4 w-full" aria-label="Caribbean peer distribution">
        <line x1="4" x2="196" y1="8" y2="8" className="stroke-line-200" strokeWidth="1" />
        <line x1={x(peer.median)} x2={x(peer.median)} y1="3" y2="13" className="stroke-ink-500" strokeWidth="0.8" />
        {peer.peers.map((p) => <circle key={p.code} cx={x(p.value)} cy="8" r="2" className="fill-ink-300" />)}
        <circle cx={x(peer.value)} cy="8" r="3.2" className="fill-gold-500 stroke-ink-950" strokeWidth="0.6" />
      </svg>
      {peer.meaningful ? (
        peer.drivers.length ? (
          <div className="mt-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">Likely drivers · inference</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-700">
              {peer.drivers.map((d, i) => (
                <li key={i}>{d.text}{d.refs.map((r) => {
                  const c = peer.citations[r - 1];
                  return c ? <a key={r} href={c.url} target="_blank" rel="noreferrer" title={c.title} className="ml-0.5 align-super text-[9px] text-gold-500 underline">[{r}]</a> : null;
                })}</li>
              ))}
            </ul>
            {peer.unknowns ? <p className="mt-1 text-ink-500">Unknown: {peer.unknowns}</p> : null}
          </div>
        ) : <p className="mt-2 text-ink-500">Explanation pending — drivers are researched in the next monthly run.</p>
      ) : null}
      <p className="mt-1 font-mono text-[9px] text-ink-500">{peer.n} peers · data {peer.periodSpan || "period n/a"}</p>
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
