import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { listKpis, listSessions } from "@/lib/mandate.functions";
import { listInstanceBindings } from "@/lib/ledger.functions";

const bindingsQuery = queryOptions({
  queryKey: ["instance-bindings"],
  queryFn: () => listInstanceBindings(),
});
function sessionsQuery(code: string) {
  return queryOptions({ queryKey: ["cabinet-sessions", code], queryFn: () => listSessions({ data: { countryCode: code } }) });
}
function kpisQuery(code: string) {
  return queryOptions({ queryKey: ["kpis", code], queryFn: () => listKpis({ data: { countryCode: code } }) });
}

export const Route = createFileRoute("/_authenticated/instrument/cabinet/session")({
  head: () => ({ meta: [{ title: "Chamber — GDPVision" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(bindingsQuery),
  component: Chamber,
});

function Chamber() {
  const { data: bindings } = useSuspenseQuery(bindingsQuery);
  const code = bindings.find((b) => b.is_default)?.country_code ?? bindings[0]?.country_code ?? "LCA";
  const { data: sessions } = useSuspenseQuery(sessionsQuery(code));
  const { data: kpis } = useSuspenseQuery(kpisQuery(code));

  const slides = [
    { kind: "title" as const, title: sessions[0]?.title ?? "Cabinet Session", subtitle: code },
    ...kpis.slice(0, 6).map((k) => ({ kind: "kpi" as const, kpi: k })),
    { kind: "close" as const, title: "Decisions & commitments", subtitle: "record in the Room" },
  ];

  const [i, setI] = useState(0);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") setI((v) => Math.min(v + 1, slides.length - 1));
      if (e.key === "ArrowLeft" || e.key === "PageUp") setI((v) => Math.max(v - 1, 0));
      if (e.key === "Escape") window.history.back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  const slide = slides[i];

  return (
    <div className="min-h-screen bg-[#0b0d10] text-[#f4f2ec]">
      <div className="flex items-center justify-between border-b border-white/10 px-10 py-4 text-[10px] font-mono uppercase tracking-[0.25em] text-white/60">
        <span>RESTRICTED · Cabinet of {code}</span>
        <span>Session · {i + 1} / {slides.length}</span>
        <Link to="/instrument/cabinet" className="hover:text-white">Exit</Link>
      </div>

      <div className="flex min-h-[calc(100vh-58px)] items-center justify-center px-16">
        {slide.kind === "title" || slide.kind === "close" ? (
          <div className="text-center">
            <p className="font-mono text-xs uppercase tracking-[0.4em] text-white/50">{slide.subtitle}</p>
            <h1 className="mt-8 font-serif text-7xl leading-tight">{slide.title}</h1>
          </div>
        ) : (
          <div className="w-full max-w-5xl">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/50">
              {slide.kpi.sector_code} · {slide.kpi.cadence}
            </p>
            <h2 className="mt-6 font-serif text-5xl">{slide.kpi.metric}</h2>
            <div className="mt-14 grid grid-cols-3 gap-10" data-numeric>
              <Metric label="Baseline" value={`${slide.kpi.baseline ?? "—"} ${slide.kpi.unit}`} />
              <Metric label="Target" value={`${slide.kpi.target} ${slide.kpi.unit}`} />
              <Metric label="Latest" value={slide.kpi.latest?.value != null ? `${slide.kpi.latest.value} ${slide.kpi.unit}` : "—"} />
            </div>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-4 flex justify-center gap-1">
        {slides.map((_, idx) => (
          <span key={idx} className={`h-1 w-8 ${idx === i ? "bg-white/80" : "bg-white/15"}`} />
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/50">{label}</p>
      <p className="mt-3 font-serif text-4xl">{value}</p>
    </div>
  );
}
