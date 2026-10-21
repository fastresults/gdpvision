import { createFileRoute } from "@tanstack/react-router";
import { EventsManager } from "@/components/events/admin/EventsManager";

export const Route = createFileRoute("/_authenticated/events-admin/enquiries")({
  head: () => ({ meta: [{ title: "Enquiries — Events Admin" }, { name: "description", content: "Requests to host a GDP Event." }, { property: "og:title", content: "Enquiries — Events Admin" }, { property: "og:description", content: "Host enquiries." }] }),
  component: () => <div className="rounded-2xl border-4 border-ev-ink bg-paper-0 p-6"><EventsManager view="enquiries" /></div>,
});
