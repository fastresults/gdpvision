import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Globe2, MapPin, Building2, Sparkles } from "lucide-react";

import { listSignals } from "@/lib/narrative-chamber.functions";
import { NarrativeJourney } from "@/components/narrative/NarrativeJourney";

function signalsQuery(code: string) {
  return queryOptions({
    queryKey: ["narrative-signals", code],
    queryFn: () => listSignals({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/narrative/")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(signalsQuery(params.code));
  },
  errorComponent: ({ error }) => <p className="text-sm text-rose-600">{error.message}</p>,
  notFoundComponent: () => <p className="text-sm text-ink-500">Not found.</p>,
  component: SignalRadarPage,
});

function SignalRadarPage() {
  const { code } = Route.useParams();
  const { data: signals } = useSuspenseQuery(signalsQuery(code));

  const byScope = {
    local: signals.filter((s) => s.scope === "local").length,
    regional: signals.filter((s) => s.scope === "regional").length,
    international: signals.filter((s) => s.scope === "international").length,
  };
  const byRec = {
    lead: signals.filter((s) => s.recommendation === "lead").length,
    amplify: signals.filter((s) => s.recommendation === "amplify").length,
    counter: signals.filter((s) => s.recommendation === "counter").length,
    monitor: signals.filter((s) => s.recommendation === "monitor").length,
  };

  return (
    <div className="space-y-6">
      <NarrativeJourney
        active="monitor"
        steps={[
          { key: "monitor", title: "① Monitor", caption: "Signal radar", done: signals.length > 0 },
          { key: "triage", title: "② Triage", caption: "Pick a signal", done: false },
          { key: "position", title: "③ Position", caption: "Draft strategy", done: false },
          { key: "publish", title: "④ Publish", caption: "Ship + track", done: false },
        ]}
      />

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          Act 1 · Monitor
        </p>
        <h2 className="mt-1 font-serif text-3xl text-ink-950">Signal Radar</h2>
        <p className="mt-2 max-w-xl text-sm text-ink-700">
          A live map of every narrative touching {code} today — local, regional, international.
          Pick a signal from the rail to move it through triage, positioning and publishing.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ScopeCard label="Local" icon={MapPin} count={byScope.local} />
        <ScopeCard label="Regional" icon={Building2} count={byScope.regional} />
        <ScopeCard label="International" icon={Globe2} count={byScope.international} />
      </div>

      <div className="border border-line-200 p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          AI recommendation mix
        </p>
        <div className="mt-3 grid grid-cols-4 gap-3">
          <RecTile label="Lead" value={byRec.lead} tone="ink" />
          <RecTile label="Amplify" value={byRec.amplify} tone="emerald" />
          <RecTile label="Counter" value={byRec.counter} tone="rose" />
          <RecTile label="Monitor" value={byRec.monitor} tone="amber" />
        </div>
      </div>

      {signals.length === 0 && (
        <div className="border border-dashed border-line-200 bg-paper-100/30 p-8 text-center">
          <Sparkles className="mx-auto text-ink-500" size={24} strokeWidth={1.5} />
          <h3 className="mt-3 font-serif text-xl text-ink-950">No signals yet</h3>
          <p className="mt-2 text-sm text-ink-700">
            Use <span className="font-mono uppercase tracking-widest">New signal</span> in the sidebar to paste a URL or raw text.
            The AI classifier will build the dossier automatically.
          </p>
        </div>
      )}
    </div>
  );
}

function ScopeCard({ label, icon: Icon, count }: { label: string; icon: typeof MapPin; count: number }) {
  return (
    <div className="border border-line-200 p-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
        <Icon size={12} /> {label}
      </div>
      <p className="mt-2 font-serif text-3xl tabular-nums text-ink-950">{count}</p>
    </div>
  );
}

function RecTile({ label, value, tone }: { label: string; value: number; tone: "ink" | "emerald" | "rose" | "amber" }) {
  const bg = { ink: "bg-ink-950 text-paper-0", emerald: "bg-emerald-50 text-emerald-800", rose: "bg-rose-50 text-rose-700", amber: "bg-amber-50 text-amber-800" }[tone];
  return (
    <div className={`border border-line-200 p-3 ${bg}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-80">{label}</p>
      <p className="mt-1 font-serif text-2xl tabular-nums">{value}</p>
    </div>
  );
}
