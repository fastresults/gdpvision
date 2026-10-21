import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";

type Crumb = { label: string; to?: string };

/** Admin route error screen with a working retry (re-runs the loader). */
export function RouteRetryError({ error, reset, crumbs }: ErrorComponentProps & { crumbs: Crumb[] }) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : "Something went wrong loading this page.";
  return (
    <SuperAdminShell crumbs={crumbs}>
      <div className="max-w-xl space-y-3">
        <p className="text-sm text-signal-negative">{message}</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Try again
        </button>
      </div>
    </SuperAdminShell>
  );
}
