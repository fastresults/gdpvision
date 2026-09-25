// The investor-facing page behind a project share link. No account, no
// platform navigation: the approved project facts, the approved investor
// materials the link includes, and a way to reply.
//
// Path is /i/$token ("investor"); /p/$token is the persona presentation room.

import { useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PackageDocument } from "@/components/investments/packages/PackageDocument";
import {
  getPublicProject,
  recordPublicPackageOpen,
  submitInterest,
  type PublicProject,
} from "@/lib/investments/public-project.functions";
import { STAGE_LABEL } from "@/lib/investments/readiness";
import { PACKAGE_KIND_LABEL } from "@/lib/syndication/db";

export const Route = createFileRoute("/i/$token")({
  head: () => ({
    meta: [
      { title: "Investment opportunity" },
      {
        name: "description",
        content: "An investment opportunity shared with you by a government.",
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "referrer", content: "no-referrer" },
      { property: "og:title", content: "Investment opportunity" },
      {
        property: "og:description",
        content: "An investment opportunity shared with you directly.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicProjectPage,
});

const ES_LABEL: Record<string, string> = {
  A: "Category A — significant impacts, fully assessed",
  B: "Category B — limited, site-specific impacts",
  C: "Category C — minimal or no adverse impacts",
  FI: "Category FI — through a financial intermediary",
};

function usd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `US$${(n / 1e9).toFixed(2)} billion`;
  if (n >= 1e6) return `US$${(n / 1e6).toFixed(1)} million`;
  return `US$${Math.round(n).toLocaleString("en-US")}`;
}

function PublicProjectPage() {
  const { token } = Route.useParams();
  const q = useQuery({
    queryKey: ["public-project", token],
    queryFn: () =>
      getPublicProject({
        data: {
          token,
          referrer:
            typeof document !== "undefined" && document.referrer ? document.referrer : undefined,
        },
      }),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return (
    <main className="min-h-dvh bg-paper-0 text-ink-950">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-14">
        {q.isLoading && <p className="text-sm text-ink-500">Opening…</p>}
        {q.error && <Unavailable />}
        {q.data && <ProjectView token={token} data={q.data} />}
      </div>
    </main>
  );
}

function Unavailable() {
  return (
    <div className="border-l-2 border-l-gold-500 py-2 pl-4">
      <h1 className="font-display text-2xl text-ink-950">This link is not available</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-700">
        It may have expired or been withdrawn. Please contact the person who sent it to you for a
        current link.
      </p>
    </div>
  );
}

function ProjectView({ token, data }: { token: string; data: PublicProject }) {
  const p = data.project;
  const teaser = data.packages.find((k) => k.kind === "teaser");
  const others = data.packages.filter((k) => k.kind !== "teaser");

  return (
    <article>
      <header className="border-b border-line-200 pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Shared by the Government of {data.countryName}
        </p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-ink-950 sm:text-4xl">
          {p.title}
        </h1>
        <p className="mt-3 text-xs text-ink-500">
          Information as of{" "}
          {new Date(p.updated).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-line-200 py-6 sm:grid-cols-4">
        <Fact label="Capital cost">{usd(p.capex_usd)}</Fact>
        <Fact label="Sector">{p.sector ?? "—"}</Fact>
        <Fact label="Structure">{p.structure ?? "—"}</Fact>
        <Fact label="Stage">{STAGE_LABEL[p.stage as keyof typeof STAGE_LABEL] ?? p.stage}</Fact>
      </dl>

      <div className="space-y-8 py-8">
        {p.summary && <Section title="The opportunity">{p.summary}</Section>}
        {p.revenue_model && <Section title="How it earns">{p.revenue_model}</Section>}
        {(p.es_category || p.climate_alignment) && (
          <Section title="Environment and climate">
            {p.es_category && (
              <p className="mb-2 text-sm text-ink-800">
                {ES_LABEL[p.es_category] ?? p.es_category} (IFC Performance Standards)
              </p>
            )}
            {p.climate_alignment}
          </Section>
        )}
        {p.risks && <Section title="Key risks">{p.risks}</Section>}
      </div>

      {teaser && (
        <section className="border-t border-line-200 py-8">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {PACKAGE_KIND_LABEL.teaser}
          </p>
          <PackageDocument kind="teaser" content={teaser.content} showWarnings={false} />
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-3 border-t border-line-200 py-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Further materials
          </p>
          {others.map((k) => (
            <details
              key={k.kind}
              className="border border-line-200 border-l-2 border-l-gold-500"
              onToggle={(e) => {
                if ((e.currentTarget as HTMLDetailsElement).open)
                  void recordPublicPackageOpen({ data: { token, kind: k.kind } });
              }}
            >
              <summary className="cursor-pointer px-4 py-3 text-sm text-ink-950">
                {PACKAGE_KIND_LABEL[k.kind] ?? k.kind}
              </summary>
              <div className="border-t border-line-200 px-4 py-4">
                <PackageDocument kind={k.kind} content={k.content} showWarnings={false} />
              </div>
            </details>
          ))}
        </section>
      )}

      {data.allowInterest && <InterestForm token={token} countryName={data.countryName} />}

      <footer className="mt-10 border-t border-line-200 pt-4 text-[11px] leading-relaxed text-ink-500">
        This page was shared with you directly and is not published elsewhere. It is provided for
        discussion and is not an offer of securities or a commitment by the Government of{" "}
        {data.countryName}.
      </footer>
    </article>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{label}</dt>
      <dd className="mt-1 text-sm text-ink-950">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl text-ink-950">{title}</h2>
      <div className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-800">
        {children}
      </div>
    </section>
  );
}

const field =
  "w-full border border-line-200 bg-paper-0 px-3 py-2 text-base text-ink-950 placeholder:text-ink-300 focus:border-ink-950 focus:outline-none sm:text-sm";

function InterestForm({ token, countryName }: { token: string; countryName: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (name.trim().length < 2) return setErr("Please give your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setErr("Please give a valid email address.");
    setBusy(true);
    try {
      await submitInterest({ data: { token, name, email, organisation, message, website } });
      setSent(true);
    } catch (e2) {
      setErr(
        e2 instanceof Error ? e2.message : "Your message could not be sent. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <section className="border-t border-line-200 py-8">
        <div className="border-l-2 border-l-signal-positive py-1 pl-4">
          <h2 className="font-display text-xl text-ink-950">Thank you</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-700">
            Your message has been passed to the investment team of the Government of {countryName}.
            They will reply to {email.trim()}.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t border-line-200 py-8">
      <h2 className="font-display text-xl text-ink-950">Express interest</h2>
      <p className="mt-1 text-sm text-ink-700">
        Tell the investment team who you are and what you would like to discuss. They will reply by
        email.
      </p>
      <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-ink-700">
            <span className="mb-1 block">Your name</span>
            <input
              className={field}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs text-ink-700">
            <span className="mb-1 block">Email</span>
            <input
              className={field}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-xs text-ink-700 sm:col-span-2">
            <span className="mb-1 block">Organisation</span>
            <input
              className={field}
              autoComplete="organization"
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
            />
          </label>
          <label className="block text-xs text-ink-700 sm:col-span-2">
            <span className="mb-1 block">Message</span>
            <textarea
              className={field}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
            />
          </label>
          {/* Left empty by people; bots fill it in. */}
          <label aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>
        {err && (
          <p role="alert" className="text-sm text-signal-negative">
            {err}
          </p>
        )}
        <button
          type="submit"
          className="btn-primary w-full px-5 py-2.5 text-sm sm:w-auto"
          disabled={busy}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
