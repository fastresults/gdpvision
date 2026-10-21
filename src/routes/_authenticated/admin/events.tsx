import { createFileRoute, redirect } from "@tanstack/react-router";

// Events moved to their own workspace at /events-admin.
export const Route = createFileRoute("/_authenticated/admin/events")({
  beforeLoad: () => {
    throw redirect({ to: "/events-admin/events" });
  },
});
