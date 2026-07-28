import { flagUrl } from "@/lib/caricom-registry";
import type { ExecutiveMasthead } from "@/lib/executive/types";
import { relTime } from "./tone";

function gdpLabel(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}tn`;
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}bn`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}m`;
  return v.toLocaleString("en-US");
}

function salutation(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** The red-box cover page: who, when, and the four numbers that frame the day. */
export function PrincipalMasthead({
  masthead,
  principal = "Prime Minister",
}: {
  masthead: ExecutiveMasthead;
  principal?: string;
}) {
  const flag = flagUrl(masthead.code, "w320");
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const figures: { label: string; value: string }[] = [
    { label: masthead.gdp_year ? `GDP ${masthead.gdp_year}` : "GDP", value: gdpLabel(masthead.gdp_usd) },
    { label: "Currency", value: masthead.currency ?? "—" },
    {
      label: "Grade A/B",
      value: masthead.grade_ab == null ? "—" : `${Math.round(masthead.grade_ab * 100)}%`,
    },
    { label: "Corpus", value: masthead.corpus_fresh_at ? relTime(masthead.corpus_fresh_at) : "—" },
  ];

  return (
    <header className="border-b border-line-200 pb-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {flag && (
            <img
              src={flag}
              alt=""
              className="h-8 w-12 shrink-0 border border-line-200 object-cover"
              loading="lazy"
            />
          )}
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500">
              Executive brief
            </p>
            <h1 className="truncate font-serif text-[30px] leading-tight text-ink-950 sm:text-[38px]">
              {masthead.name ?? masthead.code}
            </h1>
          </div>
        </div>
        <span className="shrink-0 pt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          {today}
        </span>
      </div>

      <p className="mt-4 font-serif text-[19px] text-ink-500">{salutation()}, {principal}.</p>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line-100 pt-4 sm:grid-cols-4">
        {figures.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">{f.label}</dt>
            <dd data-numeric className="mt-1 truncate font-serif text-[22px] leading-none text-ink-950">
              {f.value}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
