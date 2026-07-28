// Country switcher for the console header. The chip is the trigger; the panel
// lists every country the caller can reach, with type-to-filter. Super admins
// see all onboarded countries; country users see only their bindings. A single
// binding renders a plain, non-interactive chip.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Search } from "lucide-react";

import { listOnboardingCountries } from "@/lib/country-onboarding/agents.functions";
import { flagUrl } from "@/lib/caricom-registry";
import { useImpersonation } from "@/lib/impersonation";
import { CountryChip } from "./CountryChip";

export interface SwitchableCountry {
  code: string;
  name: string | null;
}

export function CountrySwitcher({
  code,
  name,
  isGlobalAdmin,
  bindings,
}: {
  code: string;
  name: string | null;
  isGlobalAdmin: boolean;
  bindings: SwitchableCountry[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const { enter } = useImpersonation();

  const flag = flagUrl(code, "w160");
  const switchable = isGlobalAdmin || bindings.length > 1;

  // Fetch on first open only — the console shell stays light on load.
  const all = useQuery({
    queryKey: ["onboarding", "countries"],
    queryFn: () => listOnboardingCountries(),
    enabled: isGlobalAdmin && open,
    staleTime: 5 * 60_000,
  });

  const options: SwitchableCountry[] = useMemo(() => {
    const source: SwitchableCountry[] = isGlobalAdmin
      ? ((all.data as Array<{ code: string; name: string | null }>) ?? []).map((c) => ({
          code: String(c.code),
          name: c.name ?? null,
        }))
      : bindings;
    const q = query.trim().toLowerCase();
    const filtered = q
      ? source.filter(
          (c) => c.code.toLowerCase().includes(q) || (c.name ?? "").toLowerCase().includes(q),
        )
      : source;
    return [...filtered].sort((a, b) => (a.name ?? a.code).localeCompare(b.name ?? b.code));
  }, [all.data, bindings, isGlobalAdmin, query]);

  useEffect(() => setCursor(0), [query, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  function close(refocus = true) {
    setOpen(false);
    setQuery("");
    if (refocus) triggerRef.current?.focus();
  }

  function choose(next: string) {
    close(false);
    if (next.toUpperCase() === code.toUpperCase()) return;
    if (isGlobalAdmin) enter(next.toUpperCase());
    navigate({ to: "/console/$code", params: { code: next.toUpperCase() } });
  }

  if (!switchable) {
    return <CountryChip flagUrl={flag} code={code} name={name} className="ml-1" />;
  }

  return (
    <div ref={wrapRef} className="relative ml-1">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country: ${name ?? code}. Switch country`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="group inline-flex items-center gap-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
      >
        <CountryChip
          flagUrl={flag}
          code={code}
          name={name}
          className="group-hover:border-ink-950"
        />
        <ChevronDown
          size={13}
          strokeWidth={1.75}
          className={`shrink-0 text-ink-500 transition-transform group-hover:text-ink-950 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Countries"
          className="absolute left-0 top-[calc(100%+8px)] z-40 w-[min(92vw,320px)] border border-line-200 bg-paper-0 shadow-lg"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, Math.max(options.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const pick = options[cursor];
              if (pick) choose(pick.code);
            }
          }}
        >
          <div className="flex items-center gap-2 border-b border-line-100 px-3 py-2">
            <Search size={12} strokeWidth={1.5} className="shrink-0 text-ink-300" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a country"
              aria-label="Find a country"
              className="w-full bg-transparent font-mono text-[11px] uppercase tracking-[0.14em] text-ink-950 placeholder:text-ink-300 focus:outline-none"
            />
          </div>

          <div className="max-h-[52vh] overflow-y-auto">
            {isGlobalAdmin && all.isLoading && (
              <p className="px-3 py-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
                Loading countries…
              </p>
            )}
            {!all.isLoading && options.length === 0 && (
              <p className="px-3 py-4 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-300">
                No country on record
              </p>
            )}
            {options.map((c, i) => {
              const active = c.code.toUpperCase() === code.toUpperCase();
              return (
                <button
                  key={c.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => choose(c.code)}
                  className={`grid w-full grid-cols-[20px_auto_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-line-100 px-3 py-2.5 text-left transition-colors last:border-b-0 ${
                    i === cursor ? "bg-paper-100" : ""
                  }`}
                >
                  <img
                    src={flagUrl(c.code, "w160") ?? ""}
                    alt=""
                    className="h-3.5 w-5 shrink-0 rounded-sm border border-line-100 object-cover"
                    loading="lazy"
                  />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-950">
                    {c.code.toUpperCase()}
                  </span>
                  <span className="truncate text-[13px] text-ink-500">{c.name ?? "—"}</span>
                  {active ? (
                    <Check
                      size={13}
                      strokeWidth={1.75}
                      className="shrink-0 text-ink-950"
                      aria-hidden
                    />
                  ) : (
                    <span className="w-[13px]" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>

          {isGlobalAdmin && (
            <Link
              to="/home"
              onClick={() => close(false)}
              className="block border-t border-line-200 px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500 transition-colors hover:bg-paper-100 hover:text-ink-950"
            >
              ← All countries
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
