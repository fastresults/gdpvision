// Agency · GitHub repo health.
//
// Honest scope: this panel cannot see Lovable's own sync machinery. It asks
// GitHub what it knows about the repository — existence, visibility, default
// branch, last commit — and lets the reader draw the conclusion. A last
// commit that is hours old means sync is landing. One that is weeks old,
// while work is clearly happening here, means it is not.

import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Github,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  getGithubRepoHealth,
  normalizeSlug,
  type GithubProbeState,
  type GithubRepoHealth,
} from "@/lib/github/repo-health.functions";

const SLUG_KEY = "gdpvision.github.slug";
const STALE_AFTER_HOURS = 24;

function relative(iso: string | null): string {
  if (!iso) return "unknown";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function Verdict({
  state,
  label,
  detail,
}: {
  state: GithubProbeState | "stale";
  label: string;
  detail?: string | null;
}) {
  const good = state === "ok";
  const Icon = good ? CheckCircle2 : AlertTriangle;
  return (
    <div className="flex items-start gap-2.5">
      <Icon
        aria-hidden
        className={`mt-0.5 h-4 w-4 shrink-0 ${good ? "text-ink-950" : "text-signal-caution"}`}
      />
      <div>
        <p className="text-sm text-ink-950">{label}</p>
        {detail ? <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{detail}</p> : null}
      </div>
    </div>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-line-100 py-2.5 last:border-b-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">{term}</dt>
      <dd className="text-right text-sm text-ink-950">{children}</dd>
    </div>
  );
}

export function GithubSyncPanel() {
  const probe = useServerFn(getGithubRepoHealth);
  const [slug, setSlug] = useState("");
  const [health, setHealth] = useState<GithubRepoHealth | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: (next: string) => probe({ data: { slug: next } }),
    onSuccess: (result) => {
      setHealth(result);
      setFailure(null);
    },
    onError: (err: unknown) => {
      setFailure(err instanceof Error ? err.message : String(err));
    },
  });

  // Probe once on mount with whatever slug this admin last looked at.
  useEffect(() => {
    const stored =
      typeof window === "undefined" ? "" : (window.localStorage.getItem(SLUG_KEY) ?? "");
    setSlug(stored);
    run.mutate(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function check(next: string) {
    const clean = normalizeSlug(next);
    setSlug(clean);
    if (typeof window !== "undefined") window.localStorage.setItem(SLUG_KEY, clean);
    run.mutate(clean);
  }

  const busy = run.isPending;
  const repo = health?.repo ?? null;
  const commitAgeHours = hoursSince(health?.lastCommit?.committedAt ?? null);
  const stale = commitAgeHours !== null && commitAgeHours > STALE_AFTER_HOURS;

  return (
    <section className="border border-line-200 bg-paper-0">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line-200 px-6 py-5">
        <div className="flex items-center gap-3">
          <Github aria-hidden className="h-4 w-4 text-ink-700" />
          <h2 className="font-serif text-xl text-ink-950">GitHub sync status</h2>
        </div>
        <button
          type="button"
          onClick={() => check(slug)}
          disabled={busy}
          className="btn-secondary inline-flex items-center gap-2"
        >
          {busy ? (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw aria-hidden className="h-3.5 w-3.5" />
          )}
          Re-check
        </button>
      </header>

      <div className="space-y-8 px-6 py-6">
        <p className="max-w-2xl text-[13px] leading-relaxed text-ink-500">
          This panel asks GitHub directly. It cannot observe Lovable's internal push, so it does not
          claim to: it reports whether the repository is reachable and when its last commit landed.
          A last commit older than {STALE_AFTER_HOURS} hours, while work continues here, is the
          signal that sync has stopped.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            check(slug);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="flex-1 min-w-[280px]">
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              Repository
            </span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="owner/repo"
              spellCheck={false}
              className="mt-2 w-full border border-line-200 bg-paper-0 px-3 py-2 font-mono text-[13px] text-ink-950 outline-none focus:border-ink-950"
            />
          </label>
          <button type="submit" disabled={busy} className="btn-primary">
            Check
          </button>
        </form>

        {failure ? (
          <Verdict state="error" label="The check itself failed" detail={failure} />
        ) : null}

        {health ? (
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
                Connection
              </h3>
              {health.connection.state === "ok" ? (
                <Verdict
                  state="ok"
                  label={`Connected to GitHub as ${health.connection.login ?? "unknown account"}`}
                  detail="Read calls through the connector are succeeding."
                />
              ) : (
                <Verdict
                  state={health.connection.state}
                  label={
                    health.connection.state === "unconfigured"
                      ? "No GitHub connector is linked to this project"
                      : "GitHub refused the connection"
                  }
                  detail={health.connection.detail}
                />
              )}
            </div>

            {health.connection.state === "ok" ? (
              <div className="space-y-4">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
                  Repository
                </h3>

                {!repo ? (
                  <p className="text-sm text-ink-500">
                    No repository named yet. Enter <code className="font-mono">owner/repo</code>{" "}
                    above, or pick one of the recently pushed repositories below.
                  </p>
                ) : repo.state === "ok" ? (
                  <>
                    <Verdict
                      state={stale ? "stale" : "ok"}
                      label={
                        stale
                          ? `Reachable, but the last commit is ${relative(health.lastCommit?.committedAt ?? repo.pushedAt)}`
                          : "Reachable and recently updated"
                      }
                      detail={
                        stale
                          ? "If changes have been made here since then, they are not arriving in GitHub."
                          : repo.detail
                      }
                    />
                    <dl className="mt-2 max-w-2xl">
                      <Row term="Slug">
                        {repo.htmlUrl ? (
                          <a
                            href={repo.htmlUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 font-mono text-[13px] underline underline-offset-4 hover:text-ink-hover"
                          >
                            {repo.slug}
                            <ExternalLink aria-hidden className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="font-mono text-[13px]">{repo.slug}</span>
                        )}
                      </Row>
                      <Row term="Visibility">{repo.private ? "Private" : "Public"}</Row>
                      <Row term="Default branch">
                        <span className="inline-flex items-center gap-1.5">
                          <GitBranch aria-hidden className="h-3.5 w-3.5 text-ink-500" />
                          <span className="font-mono text-[13px]">
                            {repo.defaultBranch ?? "unknown"}
                          </span>
                        </span>
                      </Row>
                      <Row term="Last push">{relative(repo.pushedAt)}</Row>
                      {health.lastCommit ? (
                        <>
                          <Row term="Last commit">
                            <a
                              href={health.lastCommit.htmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-[13px] underline underline-offset-4 hover:text-ink-hover"
                            >
                              {health.lastCommit.sha}
                            </a>{" "}
                            · {relative(health.lastCommit.committedAt)}
                          </Row>
                          <Row term="Message">
                            <span className="text-ink-700">{health.lastCommit.message}</span>
                          </Row>
                          <Row term="Author">{health.lastCommit.author ?? "unknown"}</Row>
                        </>
                      ) : null}
                    </dl>
                  </>
                ) : (
                  <Verdict
                    state={repo.state}
                    label={
                      repo.state === "missing"
                        ? `${repo.slug} was not found`
                        : `${repo.slug} could not be read`
                    }
                    detail={repo.detail}
                  />
                )}
              </div>
            ) : null}

            {health.candidates.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
                  Recently pushed by this account
                </h3>
                <div className="flex flex-wrap gap-2">
                  {health.candidates.slice(0, 12).map((c) => (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => check(c.slug)}
                      className="btn-ghost font-mono text-[11px] normal-case tracking-normal"
                      title={`Last push ${relative(c.pushedAt)}`}
                    >
                      {c.slug}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
              Checked {relative(health.checkedAt)}
            </p>
          </div>
        ) : busy ? (
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
            Asking GitHub
          </p>
        ) : null}
      </div>
    </section>
  );
}
