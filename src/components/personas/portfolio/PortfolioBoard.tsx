// Chamber 07 · Ministers track — the board. One card per portfolio, the
// Prime Minister first and set apart. Each card shows the regional profile and
// this country's overlay: status, progress, and the next action.

import { Link } from "@tanstack/react-router";
import { Crown, Landmark, Scale } from "lucide-react";

import type {
  BoardData,
  BoardPortfolio,
  SetSummary,
} from "@/lib/personas/portfolio/studio.functions";
import { cn } from "@/lib/utils";

import { MICRO, STATUS_META, formatWhen } from "./labels";

function latest(sets: SetSummary[]): SetSummary | undefined {
  return sets[0];
}
function approved(sets: SetSummary[]): SetSummary | undefined {
  return sets.find((s) => s.status === "approved");
}

function SetLine({
  code,
  set,
  label,
}: {
  code: string;
  set: SetSummary | undefined;
  label: string;
}) {
  if (!set)
    return (
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-ink-500">{label}</span>
        <span className="text-ink-400">Not started</span>
      </div>
    );
  const meta = STATUS_META[set.status];
  const progress =
    set.kind === "overlay"
      ? set.hasProfile
        ? "profile written"
        : set.phase
      : set.hasProfile
        ? `${set.personas} personas · profile written`
        : `${set.personas}/${set.target_size} personas`;
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-ink-500">{label}</span>
      <Link
        to="/admin/countries/$code/personas/portfolios/$setId"
        params={{ code, setId: set.id }}
        className="min-w-0 text-right underline decoration-line-200 underline-offset-4 hover:decoration-ink-950"
      >
        <span className={cn("mr-1.5", meta.text)}>
          <span
            className={cn(
              "mr-1 inline-block h-1.5 w-1.5 rounded-full border bg-current",
              meta.border,
            )}
          />
          v{set.version} {meta.label}
        </span>
        <span className="text-ink-500">
          {set.run_state === "failed" ? "· stopped on an error" : `· ${progress}`}
        </span>
      </Link>
    </div>
  );
}

function Card({
  code,
  p,
  data,
  busy,
  onCreate,
  pmReady,
}: {
  code: string;
  p: BoardPortfolio;
  data: BoardData;
  busy: string | null;
  onCreate: (portfolio: string, scope: "regional" | "country") => void;
  pmReady: number;
}) {
  const isPm = p.kind === "head_of_government";
  const reg = latest(p.regional);
  const regApproved = approved(p.regional);
  const ctry = latest(p.country);
  const regOpen = reg && ["draft", "returned", "submitted"].includes(reg.status);
  const ctryOpen = ctry && ["draft", "returned", "submitted"].includes(ctry.status);
  const caps = data.capabilities;
  const isOpp = p.kind === "opposition";
  const Icon = isPm ? Crown : isOpp ? Scale : Landmark;
  const due = [...p.regional, ...p.country].filter((s) => s.refresh.length);
  return (
    <article
      className={cn(
        "flex flex-col border bg-paper-0 p-4",
        isPm ? "border-ink-950 md:col-span-2" : isOpp ? "border-ink-500" : "border-line-200",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn(MICRO, "flex items-center gap-1.5")}>
            <Icon size={11} /> {p.code}
            {p.first_wave && !isPm && <span className="text-gold-500">· first wave</span>}
          </div>
          <h3 className="mt-1 font-serif text-lg leading-tight text-ink-950">
            {isPm ? "The Prime Minister" : p.label}
          </h3>
          <p
            className={cn(
              "mt-1 text-[12px] leading-snug text-ink-700",
              isPm ? "max-w-3xl" : "line-clamp-2",
            )}
          >
            {p.description}
          </p>
        </div>
      </header>

      {due.map((s) => (
        <p
          key={s.id}
          className="mt-3 border-l-2 border-signal-caution py-1 pl-3 text-[11px] text-ink-700"
        >
          Refresh due ({s.scope_key === "REGIONAL" ? "regional" : data.countryName} v{s.version}):{" "}
          {s.refresh.join("; ")}.
        </p>
      ))}
      {isOpp && (
        <p className="mt-3 border-l-2 border-line-200 py-1 pl-3 text-[12px] text-ink-700">
          The standard a government-in-waiting is held to. Feeds the Narrative chamber's opposition
          intelligence; written without partisan colour.
        </p>
      )}
      {isPm && (
        <p className="mt-3 border-l-2 border-gold-500 py-1 pl-3 text-[12px] text-ink-700">
          Built last. The Prime Minister's profile is synthesised from its own 50 personas and from
          the approved profiles of the other portfolios — {pmReady} approved so far; at least 3 are
          needed. It carries the Cabinet weighting: how the ideal head of government arbitrates
          between ministries when the envelope is fixed.
        </p>
      )}

      <div className="mt-3 space-y-1.5 border-t border-line-200 pt-3">
        <SetLine code={code} set={reg} label="Regional" />
        {regApproved && reg?.id !== regApproved.id && (
          <SetLine code={code} set={regApproved} label="In force" />
        )}
        <SetLine code={code} set={ctry} label={data.countryName} />
      </div>

      <div className="mt-2 text-[11px] text-ink-500">
        {p.ministries.length
          ? `${data.countryName}: ${p.ministries.map((m) => m.name).join("; ")}`
          : isPm
            ? ""
            : `No ${data.countryName} ministry mapped to this portfolio.`}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        {!regOpen && caps.writeRegional && (
          <button
            type="button"
            className={cn(regApproved ? "btn-ghost" : "btn-primary", "px-3 py-1.5 text-xs")}
            disabled={!!busy || !data.aiAvailable}
            onClick={() => onCreate(p.code, "regional")}
          >
            {busy === `${p.code}:regional`
              ? "Starting…"
              : regApproved
                ? "New regional version"
                : "Cast 50 personas"}
          </button>
        )}
        {regOpen && (
          <Link
            to="/admin/countries/$code/personas/portfolios/$setId"
            params={{ code, setId: reg.id }}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Open regional
          </Link>
        )}
        {regApproved && !ctryOpen && caps.writeCountry && (
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            disabled={!!busy || !data.aiAvailable}
            onClick={() => onCreate(p.code, "country")}
          >
            {busy === `${p.code}:country` ? "Starting…" : `Overlay for ${data.countryName}`}
          </button>
        )}
        {ctryOpen && (
          <Link
            to="/admin/countries/$code/personas/portfolios/$setId"
            params={{ code, setId: ctry.id }}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Open overlay
          </Link>
        )}
      </div>
      {reg && (
        <div className="mt-2 text-[10px] text-ink-400">Updated {formatWhen(reg.updated_at)}</div>
      )}
    </article>
  );
}

export function PortfolioBoard({
  code,
  data,
  busy,
  onCreate,
}: {
  code: string;
  data: BoardData;
  busy: string | null;
  onCreate: (portfolio: string, scope: "regional" | "country") => void;
}) {
  const pm = data.portfolios.find((p) => p.kind === "head_of_government");
  const opp = data.portfolios.find((p) => p.kind === "opposition");
  const rest = data.portfolios.filter((p) => p.kind === "ministry");
  const pmReady = rest.filter((p) => p.regional.some((s) => s.status === "approved")).length;
  const firstWave = rest.filter((p) => p.first_wave);
  const others = rest.filter((p) => !p.first_wave);
  return (
    <div className="space-y-8">
      {pm && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card code={code} p={pm} data={data} busy={busy} onCreate={onCreate} pmReady={pmReady} />
          {opp && (
            <Card
              code={code}
              p={opp}
              data={data}
              busy={busy}
              onCreate={onCreate}
              pmReady={pmReady}
            />
          )}
        </div>
      )}
      <section>
        <div className={MICRO}>First wave</div>
        <div className="mt-2 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {firstWave.map((p) => (
            <Card
              key={p.code}
              code={code}
              p={p}
              data={data}
              busy={busy}
              onCreate={onCreate}
              pmReady={pmReady}
            />
          ))}
        </div>
      </section>
      <section>
        <div className={MICRO}>Other portfolios</div>
        <div className="mt-2 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {others.map((p) => (
            <Card
              key={p.code}
              code={code}
              p={p}
              data={data}
              busy={busy}
              onCreate={onCreate}
              pmReady={pmReady}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
