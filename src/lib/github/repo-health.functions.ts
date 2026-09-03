// @domain core
// @tables none
// @ui src/routes/_authenticated/admin/github.tsx

// GitHub repo-health probe.
//
// The app runs in a Cloudflare Worker with no repository checkout, so it
// cannot read its own Git state. What it CAN do is ask GitHub, through the
// connector gateway, whether a given repository exists, what its default
// branch is, and when the last commit landed. A stale last commit is the
// honest proxy for "the Lovable <-> GitHub sync has stopped working" —
// it is evidence, not a fetch/push probe.

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/github";

export type GithubProbeState = "ok" | "unconfigured" | "denied" | "missing" | "error";

export interface GithubRepoHealth {
  /** Whether the GitHub connector answered at all. */
  connection: {
    state: GithubProbeState;
    /** Authenticated GitHub account behind the connection. */
    login: string | null;
    detail: string | null;
  };
  /** Null when no slug was supplied. */
  repo: {
    state: GithubProbeState;
    slug: string;
    name: string | null;
    private: boolean | null;
    defaultBranch: string | null;
    htmlUrl: string | null;
    pushedAt: string | null;
    detail: string | null;
  } | null;
  /** Latest commit on the default branch. Null when the repo probe failed. */
  lastCommit: {
    sha: string;
    message: string;
    author: string | null;
    committedAt: string | null;
    htmlUrl: string;
  } | null;
  /** Repos the connected account most recently pushed to — picker candidates. */
  candidates: Array<{ slug: string; private: boolean; pushedAt: string | null }>;
  checkedAt: string;
}

interface GatewayResult {
  status: number;
  body: unknown;
  text: string;
}

async function gateway(path: string): Promise<GatewayResult> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GITHUB_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("GitHub connector is not linked to this project.");
  }

  const res = await fetch(`${GATEWAY}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
    },
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status, body, text };
}

function messageOf(result: GatewayResult): string {
  const body = result.body as { message?: string } | null;
  return body?.message ?? result.text.slice(0, 240) ?? `HTTP ${result.status}`;
}

/** owner/repo, tolerating a pasted URL or a trailing .git. */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");
}

export const getGithubRepoHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug?: string | null } | undefined) => ({
    slug: typeof data?.slug === "string" ? normalizeSlug(data.slug) : "",
  }))
  .handler(async ({ data }): Promise<GithubRepoHealth> => {
    const checkedAt = new Date().toISOString();

    const health: GithubRepoHealth = {
      connection: { state: "unconfigured", login: null, detail: null },
      repo: null,
      lastCommit: null,
      candidates: [],
      checkedAt,
    };

    let user: GatewayResult;
    try {
      user = await gateway("/user");
    } catch (err) {
      health.connection = {
        state: "unconfigured",
        login: null,
        detail: err instanceof Error ? err.message : String(err),
      };
      return health;
    }

    if (user.status === 401 || user.status === 403) {
      health.connection = { state: "denied", login: null, detail: messageOf(user) };
      return health;
    }
    if (user.status !== 200) {
      health.connection = { state: "error", login: null, detail: messageOf(user) };
      return health;
    }

    health.connection = {
      state: "ok",
      login: (user.body as { login?: string }).login ?? null,
      detail: null,
    };

    // Recently pushed repos double as the picker list and as proof that read
    // access actually works beyond /user.
    const repos = await gateway(
      "/user/repos?per_page=30&sort=pushed&affiliation=owner,organization_member",
    );
    if (repos.status === 200 && Array.isArray(repos.body)) {
      health.candidates = (repos.body as Array<Record<string, unknown>>)
        .map((r) => ({
          slug: String(r["full_name"] ?? ""),
          private: Boolean(r["private"]),
          pushedAt: (r["pushed_at"] as string | null) ?? null,
        }))
        .filter((r) => r.slug.length > 0);
    }

    if (!data.slug || !data.slug.includes("/")) return health;

    const repo = await gateway(`/repos/${data.slug}`);
    if (repo.status === 404) {
      health.repo = {
        state: "missing",
        slug: data.slug,
        name: null,
        private: null,
        defaultBranch: null,
        htmlUrl: null,
        pushedAt: null,
        detail:
          "GitHub returned 404. Either the repository does not exist, or the connected account cannot see it.",
      };
      return health;
    }
    if (repo.status !== 200) {
      health.repo = {
        state: repo.status === 403 ? "denied" : "error",
        slug: data.slug,
        name: null,
        private: null,
        defaultBranch: null,
        htmlUrl: null,
        pushedAt: null,
        detail: messageOf(repo),
      };
      return health;
    }

    const r = repo.body as Record<string, unknown>;
    const defaultBranch = (r["default_branch"] as string | null) ?? null;
    health.repo = {
      state: "ok",
      slug: String(r["full_name"] ?? data.slug),
      name: (r["name"] as string | null) ?? null,
      private: Boolean(r["private"]),
      defaultBranch,
      htmlUrl: (r["html_url"] as string | null) ?? null,
      pushedAt: (r["pushed_at"] as string | null) ?? null,
      detail: null,
    };

    const commits = await gateway(
      `/repos/${data.slug}/commits?per_page=1${defaultBranch ? `&sha=${encodeURIComponent(defaultBranch)}` : ""}`,
    );
    if (commits.status === 200 && Array.isArray(commits.body) && commits.body.length > 0) {
      const c = commits.body[0] as Record<string, unknown>;
      const commit = (c["commit"] ?? {}) as Record<string, unknown>;
      const author = (commit["author"] ?? {}) as Record<string, unknown>;
      health.lastCommit = {
        sha: String(c["sha"] ?? "").slice(0, 7),
        message: String(commit["message"] ?? "").split("\n")[0] ?? "",
        author: (author["name"] as string | null) ?? null,
        committedAt: (author["date"] as string | null) ?? null,
        htmlUrl: String(c["html_url"] ?? ""),
      };
    } else if (commits.status !== 200) {
      health.repo.detail = `Repository reachable, but its commit history was not: ${messageOf(commits)}`;
    }

    return health;
  });
