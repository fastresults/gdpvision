// URL-backed UI state: tabs, steps, open panels and selected items live in the
// page address so Back/Forward, refresh and shared links all restore them.
//
//   const [tab, setTab] = useUrlState("tab", "gaps", { allowed: TABS });
//
// Meaningful moves (tab, step, open item) push a history entry by default so
// Back undoes them. Pass { replace: true } for filters and small toggles.
// The default value is never written to the address.

import { useCallback } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

type Opts<T extends string> = { replace?: boolean; allowed?: readonly T[] };

export function useUrlState<T extends string>(
  key: string,
  fallback: T,
  opts?: Opts<T>,
): [T, (next: T) => void];
export function useUrlState<T extends string>(
  key: string,
  fallback: T | null,
  opts?: Opts<T>,
): [T | null, (next: T | null) => void];
export function useUrlState<T extends string>(
  key: string,
  fallback: T | null,
  opts: Opts<T> = {},
): [T | null, (next: T | null) => void] {
  const navigate = useNavigate();
  const raw = useRouterState({
    select: (s) => (s.location.search as Record<string, unknown>)[key],
  });
  const str = typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : null;
  const value =
    str != null && (!opts.allowed || (opts.allowed as readonly string[]).includes(str))
      ? (str as T)
      : fallback;

  const set = useCallback(
    (next: T | null) => {
      navigate({
        to: ".",
        search: ((prev: Record<string, unknown>) => {
          const out = { ...prev };
          if (next == null || next === fallback) delete out[key];
          else out[key] = next;
          return out;
        }) as never,
        replace: opts.replace ?? false,
        resetScroll: false,
      } as never);
    },
    [navigate, key, fallback, opts.replace],
  );

  return [value, set];
}
