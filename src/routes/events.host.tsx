import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { listPublicEvents, submitHostEnquiry } from "@/lib/events/events.functions";
import { EventTile, type EventCardData } from "@/components/events/EventParts";
import { cn } from "@/lib/utils";

function SummitsStrip() {
  const q = useQuery({ queryKey: ["events", "public"], queryFn: () => listPublicEvents() });
  const evs = (q.data ?? []) as EventCardData[];
  if (!evs.length) return null;
  return (
    <section className="mx-auto max-w-[1400px] px-5 pt-16 md:px-8">
      <h2 className="ev-display text-[56px]">Our summits</h2>
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {evs.map((ev, i) => (
          <li key={ev.slug}><EventTile ev={ev} index={i} /></li>
        ))}
      </ul>
    </section>
  );
}

const TITLE = "Host a GDP Event in your country";
const DESCRIPTION =
  "Bring a GDPVision summit, ministers' roundtable or public briefing to your country. Tell us what you have in mind and we'll shape it with you.";

export const Route = createFileRoute("/events/host")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HostPage,
});

const FORMATS = [
  { t: "Leadership summit", b: "Heads of Government and ministers test national choices side by side.", c: "bg-ev-sea" },
  { t: "Ministers' roundtable", b: "A closed working session on one decision and the data behind it.", c: "bg-ev-mango" },
  { t: "Investor forum", b: "Investors and government compare options in the Investment & Resilience Studio.", c: "bg-ev-coral" },
  { t: "Public briefing", b: "Open the National Record and the Caribbean Indices to citizens and the press.", c: "bg-ev-palm text-ev-paper" },
];

function HostPage() {
  const send = useServerFn(submitHostEnquiry);
  const mut = useMutation({ mutationFn: (d: Record<string, string>) => send({ data: d as never }) });

  return (
    <>
      <section className="border-b-4 border-ev-ink bg-ev-night text-ev-paper">
        <div className="mx-auto max-w-[1400px] px-5 py-20 md:px-8">
          <h1 className="ev-display ev-rise max-w-[14ch] text-[72px] md:text-[130px]">Host an event.</h1>
          <p className="mt-6 max-w-xl text-[18px] font-medium">
            Bring GDPVision to your capital. We design the session around one real national decision and bring the
            live data to the room.
          </p>
        </div>
      </section>

      <SummitsStrip />


      <section className="mx-auto max-w-[1400px] px-5 py-16 md:px-8">
        <h2 className="ev-display text-[56px]">Formats</h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FORMATS.map((f, i) => (
            <li key={f.t} className={cn("ev-tile ev-rise rounded-3xl border-4 border-ev-ink p-6", f.c)} style={{ animationDelay: `${i * 90}ms` }}>
              <div className="ev-display text-[36px]">{f.t}</div>
              <p className="mt-3 text-[15px] font-medium">{f.b}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-[900px] px-5 pb-24 md:px-8">
        {mut.isSuccess ? (
          <div role="status" className="ev-rise rounded-3xl border-4 border-ev-ink bg-ev-mango p-8">
            <h2 className="ev-display text-[56px]">Thank you.</h2>
            <p className="mt-2 text-[17px] font-medium">We've received your enquiry and will reply within a few working days.</p>
          </div>
        ) : (
          <form
            className="rounded-3xl border-4 border-ev-ink bg-ev-paper p-8"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              mut.mutate(Object.fromEntries(Array.from(fd.entries()).map(([k, v]) => [k, String(v)])));
            }}
          >
            <h2 className="ev-display text-[48px]">Tell us about your event</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Input name="name" label="Full name" required />
              <Input name="email" label="Email" type="email" required />
              <Input name="organisation" label="Organisation" />
              <Input name="country" label="Country" />
            </div>
            <label className="mt-4 grid gap-1.5 text-[13px] font-bold uppercase tracking-wide">
              What would you like to host?
              <textarea name="message" required minLength={10} maxLength={3000} rows={5} className="rounded-xl border-[3px] border-ev-ink bg-ev-paper px-3 py-2 text-[15px] font-normal normal-case tracking-normal focus:outline-none focus:ring-4 focus:ring-ev-mango" />
            </label>
            {mut.error && <p role="alert" className="mt-4 text-[14px] font-bold text-ev-coral">{(mut.error as Error).message}</p>}
            <button type="submit" disabled={mut.isPending} className="ev-btn-primary mt-6">
              {mut.isPending ? "Sending…" : "Send enquiry"}
            </button>
          </form>
        )}
      </section>
    </>
  );
}

function Input({ label, ...p }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1.5 text-[13px] font-bold uppercase tracking-wide">
      {label}
      <input {...p} maxLength={p.type === "email" ? 320 : 200} className="rounded-xl border-[3px] border-ev-ink bg-ev-paper px-3 py-2.5 text-[15px] font-normal normal-case tracking-normal focus:outline-none focus:ring-4 focus:ring-ev-mango" />
    </label>
  );
}
