import { createFileRoute } from "@tanstack/react-router";
import { EventsManager } from "@/components/events/admin/EventsManager";

export const Route = createFileRoute("/_authenticated/events-admin/events")({
  head: () => ({ meta: [{ title: "Events — Events Admin" }, { name: "description", content: "Create, edit, publish and archive editions." }, { property: "og:title", content: "Events — Events Admin" }, { property: "og:description", content: "Manage GDP Events editions." }] }),
  component: () => <div className="rounded-2xl border-4 border-ev-ink bg-paper-0 p-6"><EventsManager view="events" /></div>,
});
