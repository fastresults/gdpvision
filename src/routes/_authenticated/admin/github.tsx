import { createFileRoute } from "@tanstack/react-router";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { GithubSyncPanel } from "@/components/admin/GithubSyncPanel";

export const Route = createFileRoute("/_authenticated/admin/github")({
  head: () => ({
    meta: [
      { title: "GitHub sync status — GDPVision" },
      {
        name: "description",
        content:
          "Check whether the GitHub repository behind this project is reachable and how recently its last commit landed.",
      },
      { property: "og:title", content: "GitHub sync status — GDPVision" },
      {
        property: "og:description",
        content:
          "Repository reachability, default branch, and last-commit recency for the connected GitHub account.",
      },
    ],
  }),
  component: GithubStatusRoute,
});

function GithubStatusRoute() {
  return (
    <SuperAdminShell crumbs={[{ label: "Admin", to: "/admin" }, { label: "GitHub" }]}>
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-ink-950">Source control</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-500">
          Whether this project's code is actually reaching GitHub, judged from what GitHub reports.
        </p>
      </header>
      <GithubSyncPanel />
    </SuperAdminShell>
  );
}
