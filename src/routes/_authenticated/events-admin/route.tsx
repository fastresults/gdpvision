import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { eventsAdminAccess } from "@/lib/events/admin-toolkit.functions";

export const Route = createFileRoute("/_authenticated/events-admin")({
  head: () => ({
    meta: [
      { title: "Events Admin — GDP Events" },
      { name: "description", content: "Run GDP Events: summit series, editions, programme, registrations, check-in and site sync." },
      { property: "og:title", content: "Events Admin — GDP Events" },
      { property: "og:description", content: "The GDP Events administration workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=Figtree:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: EventsAdminLayout,
});

const NAV = [
  { to: "/events-admin", label: "Dashboard", exact: true },
  { to: "/events-admin/series", label: "Series" },
  { to: "/events-admin/events", label: "Events" },
  { to: "/events-admin/programme", label: "Agenda, speakers & media" },
  { to: "/events-admin/registrations", label: "Registrations & check-in" },
  { to: "/events-admin/sync", label: "Site sync" },
  { to: "/events-admin/enquiries", label: "Enquiries" },
] as const;

function EventsAdminLayout() {
  const accessFn = useServerFn(eventsAdminAccess);
  const access = useQuery({ queryKey: ["events-admin", "access"], queryFn: () => accessFn() });

  return (
    <div className="theme-events min-h-dvh">
      <header className="border-b-4 border-ev-ink bg-ev-night text-ev-paper">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-8">
          <Link to="/events-admin" className="ev-display flex items-center gap-3 text-[30px]">
            <span className="flex gap-1" aria-hidden>
              <span className="h-3 w-3 rounded-full bg-ev-coral" />
              <span className="h-3 w-3 rounded-full bg-ev-mango" />
              <span className="h-3 w-3 rounded-full bg-ev-sea" />
            </span>
            Events Admin
          </Link>
          <div className="flex gap-4 text-[14px] font-semibold">
            <Link to="/events" className="hover:text-ev-mango">View public site</Link>
            <Link to="/admin/countries" className="hover:text-ev-mango">Super Admin</Link>
          </div>
        </div>
        <nav aria-label="Events Admin" className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-5 pb-3 md:px-8">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: "exact" in n }}
              className="whitespace-nowrap rounded-full px-4 py-1.5 text-[14px] font-semibold hover:bg-ev-paper/10"
              activeProps={{ className: "bg-ev-mango text-ev-ink hover:bg-ev-mango" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1400px] bg-ev-paper px-5 py-8 md:px-8">
        {access.isLoading ? (
          <p>Checking access…</p>
        ) : !access.data?.admin ? (
          <p className="rounded-2xl border-4 border-ev-ink p-6 text-[16px] font-medium">Only administrators can use Events Admin.</p>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
