import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SCENARIOS, CHAMBER_NAMES } from "./dataDecisionScenarios";

type Path = "evidence" | "safeguards" | "money" | "delivery";
type Band = 0 | 1 | 2 | 3 | 4;

interface FlowNode {
  id: string;
  band: Band;
  label: string;
  group?: string;
  what: string;
  feeds: string;
  gdp: string;
  href?: string;
  paths: Path[];
}

const BANDS = ["Evidence in", "The Second Brain", "Ten Chambers", "Decisions", "GDP outcomes"];

const NODES: FlowNode[] = [
  { id: "stats", band: 0, label: "Public statistics", what: "National accounts, trade, prices and labour figures from official and international sources.", feeds: "The Corpus, with a citation for every number.", gdp: "Starts every decision from the same trusted figures.", paths: ["evidence"] },
  { id: "ministries", band: 0, label: "Ministries & ministers", what: "Mandates, programmes and the current minister for every ministry.", feeds: "The Corpus and the Portfolios chamber.", gdp: "Shows who owns each lever of growth.", paths: ["evidence", "delivery"] },
  { id: "kpis", band: 0, label: "National KPIs", what: "Targets and latest values the government tracks.", feeds: "The Ledger, Cabinet Room and the National Record.", gdp: "Makes progress measurable instead of anecdotal.", paths: ["evidence", "delivery"] },
  { id: "flows", band: 0, label: "Capital flows", what: "Where money enters and leaves the economy — investment, fiscal spending, imports.", feeds: "The Ledger, Scenarios and the FDI Studio.", gdp: "Reveals leakages and where capital can be kept at home.", paths: ["evidence", "money"] },
  { id: "manifestos", band: 0, label: "Manifestos & mandates", what: "Party promises and the government's formal mandate.", feeds: "The Mandate Compact and Narrative chambers.", gdp: "Ties decisions to what citizens voted for.", paths: ["evidence"] },
  { id: "peers", band: 0, label: "Caribbean peer benchmarks", what: "Comparison with 22 regional nations, refreshed monthly.", feeds: "The Corpus and the Global view.", gdp: "Shows what neighbours already achieve — realistic ambition.", paths: ["evidence"] },
  { id: "private", band: 0, label: "Private government records", what: "Sensitive ministry data uploaded by the state.", feeds: "The Sovereign Vault only.", gdp: "Lets private evidence improve decisions without leaving national control.", href: "/vault", paths: ["evidence", "safeguards"] },

  { id: "corpus", band: 1, label: "The Corpus", what: "The national evidence library: every source deduplicated, cited and graded.", feeds: "All ten Chambers.", gdp: "One version of the truth removes weeks of reconciling conflicting numbers.", href: "/record", paths: ["evidence", "safeguards"] },
  { id: "vault", band: 1, label: "Sovereign Vault", what: "State-owned, state-managed servers for private data and AI analysis.", feeds: "Approved findings only — to the Chambers.", gdp: "Adds private evidence to decisions while the data stays in the country.", href: "/vault", paths: ["safeguards", "evidence"] },
  { id: "safeguards", band: 1, label: "Citations, grades & Explain", what: "Every figure shows its source, its quality grade and how it was calculated.", feeds: "Every Chamber output and brief.", gdp: "Trusted numbers get acted on sooner.", paths: ["safeguards"] },

  { id: "c01", band: 2, group: "Understand", label: "01 National Ledger", what: "The economy on one page — ask any question and see why a number is what it is.", feeds: "Scenarios, Cabinet Room, Decision Brief.", gdp: "Faster diagnosis of where growth is stalling.", paths: ["evidence"] },
  { id: "c02", band: 2, group: "Understand", label: "02 Portfolios", what: "Maps every ministry to the sectors it moves.", feeds: "Cabinet Room and Sector Studio.", gdp: "Puts the right ministry on the right growth lever.", paths: ["delivery"] },
  { id: "c03", band: 2, group: "Rehearse", label: "03 Scenarios", what: "Tests policy options against a GDP fan chart before committing.", feeds: "Cabinet Room and the Decision Brief.", gdp: "Avoids costly policy mistakes.", paths: ["money"] },
  { id: "c04", band: 2, group: "Rehearse", label: "04 FDI Transition Studio", what: "Measures exposure to foreign shocks and finds targets to reach.", feeds: "Cabinet Room and investor packages.", gdp: "Protects and redirects investment.", paths: ["money"] },
  { id: "c07", band: 2, group: "Rehearse", label: "07 Persona Lab", what: "Tests policies with simulated citizens and businesses.", feeds: "Narrative and Cabinet Room.", gdp: "Policies that people adopt deliver faster.", paths: ["evidence"] },
  { id: "c05", band: 2, group: "Decide", label: "05 Narrative", what: "Turns decisions into clear public explanation, and answers the opposition.", feeds: "Public communication.", gdp: "Public trust shortens the path from decision to delivery.", paths: ["delivery"] },
  { id: "c06", band: 2, group: "Decide", label: "06 Cabinet Room", what: "The decision queue, situation board and commitments cockpit.", feeds: "Cabinet decisions and commitments.", gdp: "Cuts decision delay — the single biggest hidden cost.", paths: ["delivery", "safeguards"] },
  { id: "c08", band: 2, group: "Decide", label: "08 Mandate Compact", what: "Turns the mandate into signed, trackable commitments.", feeds: "Commitments and the National Record.", gdp: "Keeps delivery aligned with priorities.", paths: ["delivery"] },
  { id: "c09", band: 2, group: "Deliver", label: "09 Digital Government", what: "Designs and approves digital public services.", feeds: "Delivery results.", gdp: "Removes friction that slows businesses and citizens.", paths: ["delivery"] },
  { id: "c10", band: 2, group: "Deliver", label: "10 Sector Studio", what: "Builds evidence-based growth plans for each sector.", feeds: "Investor packages and delivery.", gdp: "Targets spending where it grows output most.", paths: ["money", "delivery"] },

  { id: "brief", band: 3, label: "Decision Brief", what: "A costed, cited brief for Cabinet.", feeds: "Cabinet decisions.", gdp: "Ministers decide with the full picture on one page.", href: "/business-case/brief", paths: ["evidence", "safeguards"] },
  { id: "cabinet", band: 3, label: "Cabinet decisions", what: "Authorised choices, recorded with their evidence.", feeds: "Commitments and delivery.", gdp: "Better choices, made sooner.", paths: ["delivery", "safeguards"] },
  { id: "commit", band: 3, label: "Tracked commitments", what: "Owners, deadlines and KPIs for every decision.", feeds: "Delivery and the National Record.", gdp: "Decisions actually get delivered.", paths: ["delivery"] },
  { id: "invest", band: 3, label: "Investor packages", what: "Open-standard (OC4IDS) project packages for investors.", feeds: "Investment pipeline.", gdp: "Brings capital to national priorities.", paths: ["money"] },

  { id: "delay", band: 4, label: "Less decision delay", what: "Weeks saved between evidence and action.", feeds: "Efficiency.", gdp: "Growth arrives sooner.", paths: ["delivery"] },
  { id: "spend", band: 4, label: "Better-targeted spending", what: "Public money directed to the highest-return uses.", feeds: "Efficiency.", gdp: "More output per dollar spent.", paths: ["money"] },
  { id: "capital", band: 4, label: "Investment attracted", what: "Credible packages and stable policy draw capital.", feeds: "Elevation.", gdp: "New capacity and jobs.", paths: ["money"] },
  { id: "record", band: 4, label: "Delivery on the record", what: "Results published to the National Record.", feeds: "Back into the Corpus.", gdp: "Credibility compounds — each cycle decides faster.", href: "/record", paths: ["delivery", "evidence"] },
];

const EDGES: [string, string][] = [
  ["stats", "corpus"], ["ministries", "corpus"], ["kpis", "corpus"], ["flows", "corpus"], ["manifestos", "corpus"], ["peers", "corpus"], ["private", "vault"],
  ["corpus", "safeguards"], ["vault", "safeguards"],
  ["corpus", "c01"], ["corpus", "c02"], ["corpus", "c03"], ["corpus", "c04"], ["corpus", "c07"], ["corpus", "c05"], ["corpus", "c08"], ["corpus", "c10"], ["corpus", "c09"],
  ["vault", "c06"], ["vault", "c03"], ["safeguards", "c06"], ["safeguards", "c01"],
  ["c01", "brief"], ["c03", "brief"], ["c04", "invest"], ["c07", "brief"], ["c02", "cabinet"], ["c06", "cabinet"], ["c05", "cabinet"], ["c08", "commit"], ["c09", "commit"], ["c10", "invest"], ["c10", "commit"],
  ["brief", "cabinet"], ["cabinet", "commit"],
  ["cabinet", "delay"], ["commit", "delay"], ["brief", "spend"], ["commit", "spend"], ["invest", "capital"], ["commit", "record"],
  ["safeguards", "c07"], ["c07", "c05"], ["cabinet", "spend"], ["c02", "commit"], ["c09", "c06"], ["c06", "commit"], ["c01", "c03"],
  ["vault", "c05"], ["c04", "c03"], ["c08", "c02"], ["safeguards", "c09"],
];

if (import.meta.env.DEV) {
  const known = new Set(EDGES.map(([a, b]) => a + ">" + b));
  SCENARIOS.forEach((sc) => sc.steps.forEach((st) => st.edges.forEach(([a, b]) => {
    if (!known.has(a + ">" + b)) console.warn(`[DataDecisionFlow] scenario "${sc.title}" uses undrawn edge ${a}>${b}`);
  })));
}

const STEP_MS = 1400;
const HOLD_MS = 3000;
const DRAW_MS = 9000;

const PATH_LABEL: Record<Path, string> = { evidence: "Evidence", safeguards: "Safeguards", money: "Money", delivery: "Delivery" };

const W = 1280;
const H = 700;
const COLX = [30, 290, 545, 830, 1060];
const BOXW = [210, 210, 230, 190, 200];
const BOXH = 36;

function layout() {
  const pos: Record<string, { x: number; y: number; w: number }> = {};
  for (let b = 0; b < 5; b++) {
    const list = NODES.filter((n) => n.band === b);
    const top = 80;
    const avail = H - top - 70;
    const step = Math.min(64, avail / list.length);
    const start = top + (avail - step * list.length) / 2;
    list.forEach((n, i) => {
      pos[n.id] = { x: COLX[b], y: start + i * step + (step - BOXH) / 2, w: BOXW[b] };
    });
  }
  return pos;
}


const POS = layout();
const LOOP_D = `M ${COLX[4] + BOXW[4] / 2} ${H - 56} C ${COLX[4]} ${H - 14}, ${COLX[1] + 200} ${H - 14}, ${COLX[1] + BOXW[1] / 2} ${H - 56}`;
function edgePath(a: string, b: string) {
  const A = POS[a], B = POS[b];
  const sameBand = NODES.find((n) => n.id === a)!.band === NODES.find((n) => n.id === b)!.band;
  if (sameBand) {
    const x = A.x + A.w;
    return `M ${x} ${A.y + BOXH / 2} C ${x + 24} ${A.y + BOXH / 2}, ${x + 24} ${B.y + BOXH / 2}, ${x} ${B.y + BOXH / 2}`;
  }
  const x1 = A.x + A.w, y1 = A.y + BOXH / 2, x2 = B.x, y2 = B.y + BOXH / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

export function DataDecisionFlow() {
  const pos = POS;
  const [chamber, setChamber] = useState<string>("all");
  const playlist = useMemo(() => (chamber === "all" ? SCENARIOS : SCENARIOS.filter((x) => x.chamber === chamber)), [chamber]);
  const [scn, setScn] = useState(0);
  const [step, setStep] = useState(-1); // -1 = drawing
  const [playing, setPlaying] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Path | null>(null);
  const [reduce, setReduce] = useState(false);
  const paused = selected !== null;

  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const S = playlist[scn] ?? playlist[0];
  useEffect(() => {
    if (reduce) {
      setStep(S.steps.length);
      return;
    }
    if (paused || !playing) return;
    let ms = STEP_MS;
    let next: () => void = () => setStep((x) => x + 1);
    if (step === -1) ms = DRAW_MS;
    else if (step >= S.steps.length) {
      ms = HOLD_MS + (S.loop ? 1400 : 0);
      next = () => {
        setScn((i) => (i + 1) % playlist.length);
        setStep(0);
      };
    }
    const t = window.setTimeout(next, ms);
    return () => window.clearTimeout(t);
  }, [step, scn, paused, playing, reduce, S, playlist.length]);

  const jump = (i: number, list = playlist) => {
    setFilter(null);
    setSelected(null);
    setPlaying(true);
    setScn(i);
    setStep(reduce ? list[i].steps.length : 0);
  };
  const pickChamber = (c: string) => {
    setChamber(c);
    const list = c === "all" ? SCENARIOS : SCENARIOS.filter((x) => x.chamber === c);
    jump(0, list);
  };
  const chamberScenarios = chamber === "all" ? [] : playlist;

  const running = step >= 0;
  const doneSteps = running ? S.steps.slice(0, Math.min(step + 1, S.steps.length)) : [];
  const curStep = running && step < S.steps.length ? S.steps[step] : null;
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    setLanded(reduce);
    if (!curStep || reduce) return;
    const t = window.setTimeout(() => setLanded(true), 1200);
    return () => window.clearTimeout(t);
  }, [scn, step, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  const completed = curStep ? S.steps.slice(0, step) : doneSteps;
  const litNodes = new Set<string>(completed.flatMap((st) => st.edges.flat()));
  if (curStep) curStep.edges.forEach(([a, b]) => { litNodes.add(a); if (landed) litNodes.add(b); });
  const litEdges = new Set<string>(completed.flatMap((st) => st.edges.map(([a, b]) => a + ">" + b)));
  if (curStep && landed) curStep.edges.forEach(([a, b]) => litEdges.add(a + ">" + b));
  const activeEdges = new Set<string>(curStep ? curStep.edges.map(([a, b]) => a + ">" + b) : []);

  const sel = NODES.find((n) => n.id === selected) ?? null;
  const linked = useMemo(() => {
    if (!selected) return null;
    const s = new Set<string>([selected]);
    EDGES.forEach(([a, b]) => {
      if (a === selected) s.add(b);
      if (b === selected) s.add(a);
    });
    return s;
  }, [selected]);

  const mode: "scenario" | "path" | "node" = selected ? "node" : filter ? "path" : "scenario";
  const scenarioMode = running && mode === "scenario";
  const nodeActive = (n: FlowNode) =>
    scenarioMode ? litNodes.has(n.id) : (linked ? linked.has(n.id) : true) && (filter ? n.paths.includes(filter) : true);
  const edgeActive = (a: string, b: string) => {
    if (scenarioMode) return litEdges.has(a + ">" + b) || activeEdges.has(a + ">" + b);
    if (selected) return a === selected || b === selected;
    if (filter) {
      const na = NODES.find((n) => n.id === a)!;
      const nb = NODES.find((n) => n.id === b)!;
      return na.paths.includes(filter) && nb.paths.includes(filter);
    }
    return true;
  };

  const toggle = (id: string) => setSelected((s) => (s === id ? null : id));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Chambers">
            {["all", ...Object.keys(CHAMBER_NAMES)].map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={chamber === c}
                title={c === "all" ? "Run all 20 scenarios" : `${c} ${CHAMBER_NAMES[c]}`}
                onClick={() => pickChamber(c)}
                className={cn("card-choice h-9 shrink-0 px-2.5 font-mono text-[12px]", chamber === c && "card-choice-active")}
              >
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>
          <button type="button" className="btn-ghost" onClick={() => {
            if (mode !== "scenario") { setFilter(null); setSelected(null); setPlaying(true); }
            else setPlaying((v) => !v);
            if (step === -1) setStep(0);
          }}>
            {playing && mode === "scenario" ? "Pause" : "Play"}
          </button>
        </div>
        {chamberScenarios.length > 0 && (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 sm:col-span-2">
              Chamber {chamber} · {CHAMBER_NAMES[chamber]} — choose a scenario to run
            </div>
            {chamberScenarios.map((sc, i) => (
              <button
                key={sc.title}
                type="button"
                aria-pressed={i === scn && running}
                onClick={() => jump(i)}
                className={cn("card-choice px-3 py-2 text-left text-[13px] text-ink-950", i === scn && running && "card-choice-active")}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-500">Scenario {i + 1} · {sc.title}</span>
                <span className="mt-0.5 block">{sc.question}</span>
              </button>
            ))}
          </div>
        )}
        <div className="mb-3 min-h-[64px] border-l-2 border-gold-500 pl-3" aria-live="polite">
          {mode !== "scenario" ? (
            <div className="pt-2 text-[14px] text-ink-700">
              {mode === "path" ? `Showing the ${PATH_LABEL[filter!]} path` : `Showing ${sel?.label}'s connections`} — press Play or pick a scenario to resume.
            </div>
          ) : running ? (
            <>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                Chamber {S.chamber} · {CHAMBER_NAMES[S.chamber]} · Scenario {scn + 1} of {playlist.length} — {S.title}
              </div>
              <div className="font-display text-lg text-ink-950 md:text-xl">{S.question}</div>
              <div className="text-[14px] text-ink-700">
                {curStep ? curStep.text : <span className="text-ink-950">Outcome: {S.outcome} <span className="text-ink-500">(a pathway, never a forecast)</span></span>}
              </div>
            </>
          ) : (
            <div className="pt-2 text-[14px] text-ink-500">Drawing the national decision engine…</div>
          )}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">Show the path of</span>
          {(Object.keys(PATH_LABEL) as Path[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={filter === p}
              onClick={() => setFilter((f) => (f === p ? null : p))}
              className={cn("card-choice px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em]", filter === p && "card-choice-active")}
            >
              {PATH_LABEL[p]}
            </button>
          ))}
        </div>

        {/* Desktop map */}
        <div className="hidden min-h-0 flex-1 overflow-auto md:block">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className={cn("ddf h-full min-h-[520px] w-full", (paused || !playing) && "ddf-paused")}
            role="group"
            aria-label="Data and decision flow map"
          >
            <defs>
              <pattern id="ddf-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--line-200)" strokeWidth="1" />
              </pattern>
            </defs>

            {BANDS.map((b, i) => (
              <g key={b} className="ddf-fade" style={{ animationDelay: `${i * 1.6}s` }}>
                <rect x={COLX[i] - 12} y={34} width={BOXW[i] + 24} height={H - 90} fill={i === 1 ? "url(#ddf-hatch)" : "none"} stroke="var(--line-200)" strokeDasharray={i === 1 ? "0" : "3 4"} rx={4} />
                <text x={COLX[i] + BOXW[i] / 2} y={58} textAnchor="middle" className="fill-ink-950 font-mono" fontSize={11} letterSpacing="2.5">
                  {String(i + 1).padStart(2, "0")} · {b.toUpperCase()}
                </text>
              </g>
            ))}

            {EDGES.map(([a, b], i) => {
              const d = edgePath(a, b);
              const band = NODES.find((n) => n.id === a)!.band;
              const on = edgeActive(a, b);
              const key = a + ">" + b;
              const gold = (scenarioMode && litEdges.has(key)) || (mode === "node" && on);
              const active = scenarioMode && activeEdges.has(key) && !litEdges.has(key);
              return (
                <path
                  key={i}
                  d={d}
                  pathLength={1}
                  fill="none"
                  className="ddf-draw"
                  stroke={gold ? "var(--gold-500)" : active ? "var(--ink-950)" : "var(--ink-500)"}
                  strokeWidth={gold || active ? 1.6 : 0.9}
                  opacity={on ? (gold || active ? 0.95 : 0.55) : 0.08}
                  style={{ animationDelay: `${0.8 + band * 1.6 + (i % 7) * 0.08}s` }}
                />
              );
            })}

            {curStep && !reduce && mode === "scenario" && playing &&
              curStep.edges.map(([a, b]) =>
                [0, 1, 2].map((k) => (
                  <circle
                    key={`${scn}-${step}-${a}-${b}-${k}`}
                    r={k === 0 ? 4.5 : 3}
                    className="ddf-dot"
                    style={{ offsetPath: `path('${edgePath(a, b)}')`, animationDelay: `${k * 0.18}s` }}
                  />
                )),
              )}
            {running && step >= S.steps.length && S.loop && !reduce && playing && mode === "scenario" && (
              <circle key={`loop-${scn}`} r={4} className="ddf-dot ddf-dot-slow" style={{ offsetPath: `path('${LOOP_D}')` }} />
            )}

            {/* Feedback loop */}
            <path
              d={LOOP_D}
              pathLength={1}
              fill="none"
              stroke="var(--gold-500)"
              strokeWidth={1.4}
              strokeDasharray="0.01 0.012"
              className="ddf-draw ddf-loop"
              style={{ animationDelay: "8s" }}
              opacity={mode !== "scenario" ? 0.25 : 0.9}
            />
            <text x={(COLX[1] + COLX[4]) / 2 + 110} y={H - 2} textAnchor="middle" className="ddf-fade fill-ink-700 font-mono" fontSize={10} letterSpacing="2" style={{ animationDelay: "8.4s" }}>
              RESULTS RETURN AS EVIDENCE — EACH CYCLE DECIDES FASTER
            </text>

            {NODES.map((n) => {
              const p = pos[n.id];
              const on = nodeActive(n);
              const isSel = selected === n.id;
              const outcome = n.band === 4;
              return (
                <g
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.label}. ${n.what}`}
                  aria-pressed={isSel}
                  onClick={() => toggle(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(n.id);
                    }
                  }}
                  className="ddf-node ddf-rise cursor-pointer outline-none"
                  style={{ animationDelay: `${n.band * 1.6 + 0.3}s`, opacity: on ? 1 : 0.25 }}
                >
                  <rect
                    x={p.x}
                    y={p.y}
                    width={p.w}
                    height={BOXH}
                    rx={3}
                    fill={isSel ? "var(--ink-950)" : "var(--paper-0)"}
                    stroke={isSel || (scenarioMode && litNodes.has(n.id)) || (!scenarioMode && outcome) ? "var(--gold-500)" : "var(--ink-700)"}
                    strokeWidth={isSel || (scenarioMode && litNodes.has(n.id)) || (!scenarioMode && outcome) ? 1.8 : 0.9}
                  />
                  {scenarioMode && litNodes.has(n.id) && !reduce && (
                    <rect key={`land-${scn}`} x={p.x} y={p.y} width={p.w} height={BOXH} rx={3} fill="none" stroke="var(--gold-500)" className="ddf-land" />
                  )}
                  <text
                    x={p.x + 10}
                    y={p.y + BOXH / 2 + 4}
                    fontSize={12.5}
                    className={isSel ? "fill-paper-0" : "fill-ink-950"}
                  >
                    {n.label}
                  </text>
                  {n.group && (
                    <text x={p.x + p.w - 8} y={p.y + BOXH / 2 + 3} textAnchor="end" fontSize={8.5} letterSpacing="1.2" className={cn("font-mono", isSel ? "fill-paper-50" : "fill-ink-500")}>
                      {n.group.toUpperCase()}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Mobile stack */}
        <ol className="space-y-5 overflow-auto md:hidden">
          {BANDS.map((b, i) => (
            <li key={b}>
              <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-700">
                {String(i + 1).padStart(2, "0")} · {b} {i < 4 && "↓"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {NODES.filter((n) => n.band === i).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => toggle(n.id)}
                    aria-pressed={selected === n.id}
                    className={cn("card-choice px-2 py-2 text-left text-[13px]", selected === n.id && "card-choice-active", !nodeActive(n) && "opacity-30", scenarioMode && litNodes.has(n.id) && "border-gold-500")}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <aside className="w-full shrink-0 border-t border-line-200 pt-4 lg:w-[320px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0" aria-live="polite">
        {sel ? (
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">{BANDS[sel.band]}</div>
            <h3 className="mt-1 font-display text-2xl text-ink-950">{sel.label}</h3>
            <dl className="mt-4 space-y-4 text-[14px] leading-relaxed text-ink-700">
              <div><dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">What it does</dt><dd>{sel.what}</dd></div>
              <div><dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">What it feeds</dt><dd>{sel.feeds}</dd></div>
              <div><dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-500">Why it matters for GDP</dt><dd className="text-ink-950">{sel.gdp}</dd></div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-3">
              {sel.href && <a href={sel.href} className="btn-secondary">Learn more</a>}
              <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>Resume the flow</button>
            </div>
          </div>
        ) : (
          <div className="text-[14px] leading-relaxed text-ink-700">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">How to read this map</div>
            <p className="mt-2">Evidence enters on the left, is checked and protected in the Second Brain, worked by ten Chambers, and becomes decisions that lift output on the right.</p>
            <p className="mt-3">Select any box to pause and see what it does and why it matters. Use the path buttons to follow one thread.</p>
            <p className="mt-3 text-ink-500">A pathway, never a forecast. Private data never leaves national control.</p>
          </div>
        )}
      </aside>

      {/* Screen-reader outline */}
      <div className="sr-only">
        <h3>Connections</h3>
        <ul>{EDGES.map(([a, b]) => <li key={a + b}>{NODES.find((n) => n.id === a)!.label} feeds {NODES.find((n) => n.id === b)!.label}</li>)}</ul>
      </div>
    </div>
  );
}
