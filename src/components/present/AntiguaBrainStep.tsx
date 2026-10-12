import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  BrainConstellation,
  type BrainFilter,
  type BrainRow,
} from "@/components/country-data/BrainConstellation";
import { listAllMemory } from "@/lib/country-data/manage.functions";
import { getCountryBrainShape } from "@/lib/present/corpus-snapshot.functions";
import { DEMO_COUNTRY } from "@/lib/present/chambers";
import { cn } from "@/lib/utils";
import { LiveFrame } from "./LiveFrame";

/** Antigua's real Second Brain, enlarged, beside the live data-source switches. */
function useIsAdmin() {
  return useQuery({
    queryKey: ["present", "is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data: ok } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      return Boolean(ok);
    },
    staleTime: 5 * 60_000,
  }).data;
}

export function AntiguaBrainStep() {
  const [wide, setWide] = useState(false);
  const [filter, setFilter] = useState<BrainFilter>({ country: DEMO_COUNTRY });
  const admin = useIsAdmin();
  const fullFn = useServerFn(listAllMemory);
  const full = useQuery({
    queryKey: ["present", "brain-full", DEMO_COUNTRY],
    queryFn: async () =>
      ((await fullFn()) as BrainRow[]).filter((r) => r.scope_key === DEMO_COUNTRY),
    enabled: admin === true,
    staleTime: 5 * 60_000,
  });
  const shape = useQuery({
    queryKey: ["present", "brain-shape", DEMO_COUNTRY],
    queryFn: () => getCountryBrainShape({ data: { country: DEMO_COUNTRY } }),
    staleTime: 10 * 60_000,
  });
  const rows: BrainRow[] = (admin && full.data) || shape.data || [];

  return (
    <div className={cn("grid w-full min-w-0 items-center gap-10 lg:gap-0", wide ? "grid-cols-1" : "lg:grid-cols-2")}>
      <div className={cn("lg:pl-24 lg:pr-10", wide && "hidden")}>
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
          06 · Antigua &amp; Barbuda · the Second Brain
        </div>
        <h2 className="mt-3 font-display text-[clamp(1.9rem,3.2vw,3rem)] leading-[1.04] tracking-tight text-ink-950">
          This is Antigua's Second Brain — live.
        </h2>
        <p className="mt-3 text-[clamp(1rem,1.2vw,1.12rem)] leading-[1.5] text-ink-700">
          Every circle is a sector the government's evidence is organised by; every dot is a memory
          GDPVision can cite.
        </p>
        <div className="mt-4 w-full">
          {rows.length > 0 ? (
            <BrainConstellation
              rows={rows}
              mode="single"
              centerLabel={DEMO_COUNTRY}
              filter={filter}
              onFilter={(f) => setFilter({ ...f, country: DEMO_COUNTRY })}
            />
          ) : (
            <div className="flex aspect-square items-center justify-center font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">
              Loading the Second Brain…
            </div>
          )}
        </div>
      </div>
      <div className="prs-rise min-w-0 w-full" style={{ animationDelay: "200ms" }}>
        <LiveFrame
          preloadId="antigua-brain"
          src={`/admin/countries/${DEMO_COUNTRY}/onboard`}
          label={`gdpvision.com/admin/countries/${DEMO_COUNTRY}/onboard`}
          title={`Data sources for ${DEMO_COUNTRY}, live`}
          wide={wide}
          onWide={() => setWide(true)}
          onNarrow={() => setWide(false)}
        />
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-500">
          The live control panel — turn a source on or off and the Second Brain re-weights.
        </p>
      </div>
    </div>
  );
}
