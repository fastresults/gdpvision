import { createFileRoute, redirect } from "@tanstack/react-router";

// The brief is now the console home. Kept as a permanent redirect so existing
// links, bookmarks, and print targets keep working.
export const Route = createFileRoute("/_authenticated/console/$code/brief")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/console/$code", params: { code: params.code }, replace: true });
  },
});
