import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SCENARIOS, CHAMBER_NAMES } from "./dataDecisionScenarios";
import { FlowDiagramStage } from "./FlowDiagramStage";

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

const BANDS = ["Gather information", "Connect and protect", "Work through choices", "Approve and assign", "Track and improve"];

const NODES: FlowNode[] = [
  {
    id: "stats",
    band: 0,
    label: "Public statistics",
    what: "National accounts, trade, prices and labour figures from official and international sources.",
    feeds: "The national evidence library, with source references.",
    gdp: "Gives government a shared starting point, with sources it can check.",
    paths: ["evidence"],
  },
  {
    id: "ministries",
    band: 0,
    label: "Ministries & ministers",
    what: "Mandates, programmes and the current minister for every ministry.",
    feeds: "The national evidence library and Ministry Growth & Delivery workspace.",
    gdp: "Shows which ministry is responsible for each economic priority.",
    paths: ["evidence", "delivery"],
  },
  {
    id: "kpis",
    band: 0,
    label: "National progress measures",
    what: "Targets and latest values the government tracks.",
    feeds: "The Ledger, Cabinet Room and the National Record.",
    gdp: "Makes progress measurable instead of anecdotal.",
    paths: ["evidence", "delivery"],
  },
  {
    id: "flows",
    band: 0,
    label: "Investment & money flows",
    what: "Where money enters and leaves the economy — investment, fiscal spending, imports.",
    feeds: "National evidence, policy scenarios and investment planning.",
    gdp: "Shows where money leaves the economy and where local production or investment could add value.",
    paths: ["evidence", "money"],
  },
  {
    id: "manifestos",
    band: 0,
    label: "Manifestos & mandates",
    what: "Party promises and the government's formal mandate.",
    feeds: "The Mandate Compact and Narrative chambers.",
    gdp: "Ties decisions to what citizens voted for.",
    paths: ["evidence"],
  },
  {
    id: "peers",
    band: 0,
    label: "Caribbean peer benchmarks",
    what: "Comparison with 22 regional nations, refreshed monthly.",
    feeds: "The national evidence library and country comparisons.",
    gdp: "Shows what neighbours already achieve — realistic ambition.",
    paths: ["evidence"],
  },
  {
    id: "private",
    band: 0,
    label: "Private government records",
    what: "Sensitive ministry data uploaded by the state.",
    feeds: "The Sovereign Vault only.",
    gdp: "Lets private evidence improve decisions without leaving national control.",
    href: "/vault",
    paths: ["evidence", "safeguards"],
  },

  {
    id: "corpus",
    band: 1,
    label: "Second Brain · evidence library",
    what: "The connected national evidence library: sources brought together with references and reliability checks.",
    feeds: "All ten Chambers.",
    gdp: "Helps ministries compare sources and resolve conflicting figures before deciding.",
    href: "/record",
    paths: ["evidence", "safeguards"],
  },
  {
    id: "vault",
    band: 1,
    label: "Sovereign Vault",
    what: "Protected government-controlled storage for sensitive records and analysis.",
    feeds: "Approved findings only — to the Chambers.",
    gdp: "Adds private evidence to decisions while the data stays in the country.",
    href: "/vault",
    paths: ["safeguards", "evidence"],
  },
  {
    id: "safeguards",
    band: 1,
    label: "Sources & reliability checks",
    what: "Review source references, reliability and the reasoning behind figures before using them.",
    feeds: "Every Chamber output and brief.",
    gdp: "Lets ministers see the evidence and limitations behind a recommendation.",
    paths: ["safeguards"],
  },

  {
    id: "c01",
    band: 2,
    group: "Understand",
    label: "01 National Evidence Ledger",
    what: "The economy on one page — ask any question and see why a number is what it is.",
    feeds: "Scenarios, Cabinet Room, Decision Brief.",
    gdp: "Faster diagnosis of where growth is stalling.",
    paths: ["evidence"],
  },
  {
    id: "c02",
    band: 2,
    group: "Understand",
    label: "02 Ministry Growth & Delivery",
    what: "Connect ministry responsibilities with sector priorities, shared dependencies and progress measures.",
    feeds: "Cabinet Room and Sector Studio.",
    gdp: "Clarifies which ministry should lead an action and which should support it.",
    paths: ["delivery"],
  },
  {
    id: "c03",
    band: 2,
    group: "Rehearse",
    label: "03 Policy Scenarios",
    what: "Compare policy options and projected economic effects, with assumptions and uncertainty visible.",
    feeds: "Cabinet Room and the Decision Brief.",
    gdp: "Helps identify costly trade-offs before committing resources.",
    paths: ["money"],
  },
  {
    id: "c04",
    band: 2,
    group: "Rehearse",
    label: "04 Investment & Resilience",
    what: "Measures exposure to foreign shocks and finds targets to reach.",
    feeds: "Cabinet Room and investor packages.",
    gdp: "Protects and redirects investment.",
    paths: ["money"],
  },
  {
    id: "c07",
    band: 2,
    group: "Rehearse",
    label: "07 Policy & Leadership Lab",
    what: "Explore policies with simulated citizen and business profiles, and study the skills a leadership role needs.",
    feeds: "Narrative and Cabinet Room.",
    gdp: "Highlights possible concerns before launch; simulated responses are not a public survey.",
    paths: ["evidence"],
  },
  {
    id: "c05",
    band: 2,
    group: "Decide",
    label: "05 Confidence & Communications",
    what: "Turns decisions into clear public explanation, and answers the opposition.",
    feeds: "Public communication.",
    gdp: "Public trust shortens the path from decision to delivery.",
    paths: ["delivery"],
  },
  {
    id: "c06",
    band: 2,
    group: "Decide",
    label: "06 Cabinet Decisions & Delivery",
    what: "Bring priority decisions, supporting evidence and delivery progress into one Cabinet workspace.",
    feeds: "Cabinet decisions and commitments.",
    gdp: "Helps Cabinet address urgent priorities without losing sight of delivery.",
    paths: ["delivery", "safeguards"],
  },
  {
    id: "c08",
    band: 2,
    group: "Decide",
    label: "08 Mandate & Accountability",
    what: "Turns the mandate into signed, trackable commitments.",
    feeds: "Commitments and the National Record.",
    gdp: "Keeps delivery aligned with priorities.",
    paths: ["delivery"],
  },
  {
    id: "c09",
    band: 2,
    group: "Deliver",
    label: "09 Digital Government Planning",
    what: "Designs and approves digital public services.",
    feeds: "Delivery results.",
    gdp: "Helps plan simpler services that can save time for citizens and businesses.",
    paths: ["delivery"],
  },
  {
    id: "c10",
    band: 2,
    group: "Deliver",
    label: "10 Sector Growth & Delivery",
    what: "Builds evidence-based growth plans for each sector.",
    feeds: "Investor packages and delivery.",
    gdp: "Helps compare sector priorities before committing public money.",
    paths: ["money", "delivery"],
  },

  {
    id: "brief",
    band: 3,
    label: "Decision Brief",
    what: "A costed, cited brief for Cabinet.",
    feeds: "Cabinet decisions.",
    gdp: "Ministers decide with the full picture on one page.",
    href: "/business-case/brief",
    paths: ["evidence", "safeguards"],
  },
  {
    id: "cabinet",
    band: 3,
    label: "Cabinet decisions",
    what: "Authorised choices, recorded with their evidence.",
    feeds: "Commitments and delivery.",
    gdp: "Better choices, made sooner.",
    paths: ["delivery", "safeguards"],
  },
  {
    id: "commit",
    band: 3,
    label: "Tracked commitments",
    what: "Responsible leaders, deadlines and progress measures for agreed actions.",
    feeds: "Delivery and the National Record.",
    gdp: "Makes agreed actions and missed deadlines visible to government.",
    paths: ["delivery"],
  },
  {
    id: "invest",
    band: 3,
    label: "Investor packages",
    what: "Project information in a recognised open format, with costs, checks and delivery responsibilities for investor review.",
    feeds: "Investment pipeline.",
    gdp: "Helps investors review projects aligned with national priorities.",
    paths: ["money"],
  },

  {
    id: "delay",
    band: 4,
    label: "Less decision delay",
    what: "Prepared evidence and clear responsibility can reduce avoidable delays.",
    feeds: "Better use of public resources.",
    gdp: "Lets government move from discussion to approved action with less wasted time.",
    paths: ["delivery"],
  },
  {
    id: "spend",
    band: 4,
    label: "Better-targeted spending",
    what: "Compare expected value, costs and evidence before allocating public money.",
    feeds: "Better use of public resources.",
    gdp: "Helps government assess whether public spending is producing the intended results.",
    paths: ["money"],
  },
  {
    id: "capital",
    band: 4,
    label: "Stronger investment preparation",
    what: "Clear project information and consistent policy help investors assess national opportunities.",
    feeds: "Investment and employment opportunities.",
    gdp: "Helps prepare investment that could expand production and employment.",
    paths: ["money"],
  },
  {
    id: "record",
    band: 4,
    label: "Delivery on the record",
    what: "Results published to the National Record.",
    feeds: "Back into the national evidence library.",
    gdp: "Recorded results help government improve the next decision.",
    href: "/record",
    paths: ["delivery", "evidence"],
  },
];

const EDGES: [string, string][] = [
  ["stats", "corpus"],
  ["ministries", "corpus"],
  ["kpis", "corpus"],
  ["flows", "corpus"],
  ["manifestos", "corpus"],
  ["peers", "corpus"],
  ["private", "vault"],
  ["corpus", "safeguards"],
  ["vault", "safeguards"],
  ["corpus", "c01"],
  ["corpus", "c02"],
  ["corpus", "c03"],
  ["corpus", "c04"],
  ["corpus", "c07"],
  ["corpus", "c05"],
  ["corpus", "c08"],
  ["corpus", "c10"],
  ["corpus", "c09"],
  ["vault", "c06"],
  ["vault", "c03"],
  ["safeguards", "c06"],
  ["safeguards", "c01"],
  ["c01", "brief"],
  ["c03", "brief"],
  ["c04", "invest"],
  ["c07", "brief"],
  ["c02", "cabinet"],
  ["c06", "cabinet"],
  ["c05", "cabinet"],
  ["c08", "commit"],
  ["c09", "commit"],
  ["c10", "invest"],
  ["c10", "commit"],
  ["brief", "cabinet"],
  ["cabinet", "commit"],
  ["cabinet", "delay"],
  ["commit", "delay"],
  ["brief", "spend"],
  ["commit", "spend"],
  ["invest", "capital"],
  ["commit", "record"],
  ["safeguards", "c07"],
  ["c07", "c05"],
  ["cabinet", "spend"],
  ["c02", "commit"],
  ["c09", "c06"],
  ["c06", "commit"],
  ["c01", "c03"],
  ["vault", "c05"],
  ["c04", "c03"],
  ["c08", "c02"],
  ["safeguards", "c09"],
];

if (import.meta.env.DEV) {
  const known = new Set(EDGES.map(([a, b]) => a + ">" + b));
  SCENARIOS.forEach((sc) =>
    sc.steps.forEach((st) =>
      st.edges.forEach(([a, b]) => {
        if (!known.has(a + ">" + b))
          console.warn(`[DataDecisionFlow] scenario "${sc.title}" uses undrawn edge ${a}>${b}`);
      }),
    ),
  );
}

const STEP_MS = 4200;
const HOLD_MS = 5500;
const DRAW_MS = 9000;

const PATH_LABEL: Record<Path, string> = {
  evidence: "Evidence",
  safeguards: "Safeguards",
  money: "Money",
  delivery: "Delivery",
};

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
  const A = POS[a],
    B = POS[b];
  const sameBand = NODES.find((n) => n.id === a)!.band === NODES.find((n) => n.id === b)!.band;
  if (sameBand) {
    const x = A.x + A.w;
    return `M ${x} ${A.y + BOXH / 2} C ${x + 24} ${A.y + BOXH / 2}, ${x + 24} ${B.y + BOXH / 2}, ${x} ${B.y + BOXH / 2}`;
  }
  const x1 = A.x + A.w,
    y1 = A.y + BOXH / 2,
    x2 = B.x,
    y2 = B.y + BOXH / 2;
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

export function DataDecisionFlow({ presentation = false }: { presentation?: boolean }) {
  const pos = POS;
  const [chamber, setChamber] = useState<string>("all");
  const playlist = useMemo(
    () => (chamber === "all" ? SCENARIOS : SCENARIOS.filter((x) => x.chamber === chamber)),
    [chamber],
  );
  const [scn, setScn] = useState(0);
  const [step, setStep] = useState(-1); // -1 = drawing
  const [playing, setPlaying] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Path | null>(null);
  const [reduce, setReduce] = useState(false);
  const [trayOpen, setTrayOpen] = useState(true);
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
  if (curStep)
    curStep.edges.forEach(([a, b]) => {
      litNodes.add(a);
      if (landed) litNodes.add(b);
    });
  const litEdges = new Set<string>(
    completed.flatMap((st) => st.edges.map(([a, b]) => a + ">" + b)),
  );
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
    scenarioMode
      ? litNodes.has(n.id)
      : (linked ? linked.has(n.id) : true) && (filter ? n.paths.includes(filter) : true);
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

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = current === id ? null : id;
      if (next) setTrayOpen(true);
      return next;
    });
  };

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col md:h-full md:min-h-0 lg:flex-row",
        presentation ? "gap-3" : "gap-4",
      )}
    >
      <FlowDiagramStage fitted={presentation}>
      <div className="flex min-w-0 flex-col md:h-full md:min-h-0 md:flex-1">
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 shrink-0",
            presentation ? "mb-2" : "mb-3",
          )}
        >
          <div
            className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-1"
            role="tablist"
            aria-label="Chambers"
          >
            {["all", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10"].map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={chamber === c}
                aria-label={c === "all" ? "All scenarios" : `Chamber ${c} ${CHAMBER_NAMES[c]}`}
                onClick={() => pickChamber(c)}
                className={cn(
                  "card-choice h-9 shrink-0 px-2.5 font-mono text-[12px]",
                  chamber === c && "card-choice-active",
                )}
              >
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              if (mode !== "scenario") {
                setFilter(null);
                setSelected(null);
                setPlaying(true);
              } else setPlaying((v) => !v);
              if (step === -1) setStep(0);
            }}
          >
            {playing && mode === "scenario" ? "Pause" : "Play"}
          </button>
        </div>
        {chamberScenarios.length > 0 && (
          <div className={cn("grid gap-2 sm:grid-cols-2 shrink-0", presentation ? "mb-2" : "mb-3")}>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 sm:col-span-2">
              Chamber {chamber} · {CHAMBER_NAMES[chamber]} — choose a national priority
            </div>
            {chamberScenarios.map((sc, i) => (
              <button
                key={sc.title}
                type="button"
                aria-pressed={i === scn && running}
                onClick={() => jump(i)}
                className={cn(
                  "card-choice px-3 py-2 text-left text-[13px]",
                  i === scn && running ? "card-choice-active" : "text-ink-950",
                )}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-70">
                  Scenario {i + 1} · {sc.title}
                </span>
                <span className="mt-0.5 block">{sc.question}</span>
              </button>
            ))}
          </div>
        )}
        <div
          className={cn(
            "border-l-2 border-gold-500 pl-3 shrink-0",
            presentation ? "mb-2 min-h-[58px]" : "mb-3 min-h-[64px]",
          )}
          aria-live="polite"
        >
          {mode !== "scenario" ? (
            <div className="pt-2 text-[14px] text-ink-700">
              {mode === "path"
                ? `Showing the ${PATH_LABEL[filter!]} path`
                : `Showing ${sel?.label}'s connections`}{" "}
              — press Play or pick a scenario to resume.
            </div>
          ) : running ? (
            <>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
                Chamber {S.chamber} · {CHAMBER_NAMES[S.chamber]} · Scenario {scn + 1} of{" "}
                {playlist.length} — {S.title}
              </div>
              <div className="font-display text-lg text-ink-950 md:text-xl">{S.question}</div>
              <div className="text-[14px] text-ink-700">
                {curStep ? (
                  curStep.text
                ) : (
                  <span className="text-ink-950">
                    Outcome: {S.outcome}{" "}
                    <span className="text-ink-500">(illustrative benefit, not a growth forecast)</span>
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="pt-2 text-[14px] text-ink-500">
              Connecting the national evidence and decision tools…
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 shrink-0",
            presentation ? "mb-2" : "mb-3",
          )}
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-500">
            Show the path of
          </span>
          {(Object.keys(PATH_LABEL) as Path[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={filter === p}
              onClick={() => setFilter((f) => (f === p ? null : p))}
              className={cn(
                "card-choice px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em]",
                filter === p && "card-choice-active",
              )}
            >
              {PATH_LABEL[p]}
            </button>
          ))}
        </div>

        {/* Desktop map */}
        <div className="hidden min-h-0 flex-1 overflow-auto md:block">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            onClick={() => !reduce && setPlaying((value) => !value)}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (!reduce) setPlaying((value) => !value);
              }
            }}
            className={cn(
              "ddf h-full w-full",
              "min-h-0",
              (paused || !playing) && "ddf-paused",
            )}
            role="group"
            aria-label={playing ? "National decision flow — pause animation" : "National decision flow — resume animation"}
          >
            <defs>
              <pattern
                id="ddf-hatch"
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--line-200)" strokeWidth="1" />
              </pattern>
            </defs>

            {BANDS.map((b, i) => (
              <g key={b} className="ddf-fade" style={{ animationDelay: `${i * 1.6}s` }}>
                <rect
                  x={COLX[i] - 12}
                  y={34}
                  width={BOXW[i] + 24}
                  height={H - 90}
                  fill={i === 1 ? "url(#ddf-hatch)" : "none"}
                  stroke="var(--line-200)"
                  strokeDasharray={i === 1 ? "0" : "3 4"}
                  rx={4}
                />
                <text
                  x={COLX[i] + BOXW[i] / 2}
                  y={58}
                  textAnchor="middle"
                  className="fill-ink-950 font-mono"
                  fontSize={11}
                  letterSpacing="0"
                >
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

            {curStep &&
              !reduce &&
              mode === "scenario" &&
              playing &&
              curStep.edges.map(([a, b]) =>
                [0, 1, 2].map((k) => (
                  <circle
                    key={`${scn}-${step}-${a}-${b}-${k}`}
                    r={k === 0 ? 4.5 : 3}
                    className="ddf-dot"
                    style={{
                      offsetPath: `path('${edgePath(a, b)}')`,
                      animationDelay: `${k * 0.18}s`,
                    }}
                  />
                )),
              )}
            {running &&
              step >= S.steps.length &&
              S.loop &&
              !reduce &&
              playing &&
              mode === "scenario" && (
                <circle
                  key={`loop-${scn}`}
                  r={4}
                  className="ddf-dot ddf-dot-slow"
                  style={{ offsetPath: `path('${LOOP_D}')` }}
                />
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
            <text
              x={(COLX[1] + COLX[4]) / 2 + 110}
              y={H - 2}
              textAnchor="middle"
              className="ddf-fade fill-ink-700 font-mono"
              fontSize={10}
              letterSpacing="2"
              style={{ animationDelay: "8.4s" }}
            >
              USE THE RESULTS TO IMPROVE THE NEXT DECISION
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
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(n.id);
                  }}
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
                    stroke={
                      isSel || (scenarioMode && litNodes.has(n.id)) || (!scenarioMode && outcome)
                        ? "var(--gold-500)"
                        : "var(--ink-700)"
                    }
                    strokeWidth={
                      isSel || (scenarioMode && litNodes.has(n.id)) || (!scenarioMode && outcome)
                        ? 1.8
                        : 0.9
                    }
                  />
                  {scenarioMode && litNodes.has(n.id) && !reduce && (
                    <rect
                      key={`land-${scn}`}
                      x={p.x}
                      y={p.y}
                      width={p.w}
                      height={BOXH}
                      rx={3}
                      fill="none"
                      stroke="var(--gold-500)"
                      className="ddf-land"
                    />
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
                    <text
                      x={p.x + p.w - 8}
                      y={p.y + BOXH / 2 + 3}
                      textAnchor="end"
                      fontSize={8.5}
                      letterSpacing="1.2"
                      className={cn("font-mono", isSel ? "fill-paper-50" : "fill-ink-500")}
                    >
                    {""}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(n.id);
                    }}
                    aria-pressed={selected === n.id}
                    className={cn(
                      "card-choice px-2 py-2 text-left text-[13px]",
                      selected === n.id && "card-choice-active",
                      !nodeActive(n) && "opacity-30",
                      scenarioMode && litNodes.has(n.id) && "border-gold-500",
                    )}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>

      </FlowDiagramStage>
      <aside
        id="decision-flow-guide"
        className={cn(
          "relative mt-4 w-full shrink-0 border-t border-line-200 bg-paper-0 transition-[width] duration-300 motion-reduce:transition-none lg:mt-0 lg:h-full lg:border-l lg:border-t-0",
          trayOpen
            ? "lg:w-[min(30vw,360px)]"
            : "lg:w-12",
        )}
        aria-live="polite"
      >
        <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-line-200 bg-paper-0 px-3 lg:h-11">
          <span
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500",
              !trayOpen && "lg:sr-only",
            )}
          >
            {sel ? "Selected connection" : "How this flow works"}
          </span>
          <button
            type="button"
            className="btn-ghost ml-auto h-8 w-8 shrink-0 p-0"
            aria-expanded={trayOpen}
            aria-controls="decision-flow-guide-content"
            aria-label={trayOpen ? "Collapse how this flow works" : "Expand how this flow works"}
            title={trayOpen ? "Collapse guide" : "Expand guide"}
            onClick={() => setTrayOpen((open) => !open)}
          >
            {trayOpen ? (
              <PanelRightClose className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <div
          id="decision-flow-guide-content"
          className={cn(
            "overflow-y-auto px-4 py-4 lg:h-[calc(100%-2.75rem)] lg:px-5",
            !trayOpen && "hidden",
          )}
        >
          {sel ? (
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              {BANDS[sel.band]}
            </div>
            <h3 className="mt-1 font-display text-2xl text-ink-950">{sel.label}</h3>
            <dl className="mt-4 space-y-4 text-[14px] leading-relaxed text-ink-700">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  What it does
                </dt>
                <dd>{sel.what}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
                  Where it helps next
                </dt>
                <dd>{sel.feeds}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-500">
                  Value for the economy
                </dt>
                <dd className="text-ink-950">{sel.gdp}</dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-3">
              {sel.href && (
                <a href={sel.href} className="btn-secondary">
                  Learn more
                </a>
              )}
              <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>
                Resume the flow
              </button>
            </div>
          </div>
        ) : (
          <div className="text-[14px] leading-relaxed text-ink-700">
            <ol className="mt-2 space-y-2.5">
              {[
                [
                  "Gather the information.",
                  "Bring together official figures, ministry plans, progress measures and investment data, alongside comparisons with other countries.",
                ],
                [
                  "Connect and protect it.",
                  "The Second Brain is the connected national evidence library. Check sources and reliability; use sensitive records only under government control.",
                ],
                [
                  "Work through the choices.",
                  "Ten Chambers—connected digital workspaces—help ministries understand problems, compare options and prepare action for approval.",
                ],
                [
                  "Approve and assign action.",
                  "Cabinet reviews the evidence and choices. Record approved actions, responsible leaders and deadlines; prepare projects for investor review.",
                ],
                [
                  "Track results and improve.",
                  "Track delivery and learn what worked. Better use of public money, stronger investment preparation and coordinated action can support lasting economic progress.",
                ],
              ].map(([head, body], i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-[11px] font-semibold text-gold-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong className="font-semibold text-ink-950">{head}</strong> {body}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-l-2 border-gold-500 pl-3 font-display text-[14px] italic leading-relaxed text-ink-950">
              GDPVision connects evidence, policy, investment and delivery so government can act
              with a clearer picture, a record of its decisions and responsibility for results.
            </p>
            <p className="mt-3 text-ink-500">
              Illustrative scenarios, not measured results or growth forecasts. Government remains in control of sensitive information.
            </p>
            <p className="mt-3 text-[13px] text-ink-500">
              Sources, approval and responsibility stay visible throughout the decision.
            </p>
          </div>
          )}
        </div>
      </aside>

      {/* Screen-reader outline */}
      <div className="sr-only">
        <h3>Connections</h3>
        <ul>
          {EDGES.map(([a, b]) => (
            <li key={a + b}>
              {NODES.find((n) => n.id === a)!.label} feeds {NODES.find((n) => n.id === b)!.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
