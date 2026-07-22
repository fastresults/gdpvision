// Super-admin "View as country user" mode.
//
// UI-only impersonation: this does NOT change the caller's identity on the
// server. Server functions still run as the real super-admin user, so RLS
// and audit trails reflect the real actor. The mode only changes what the
// UI renders so a super admin can preview the country-user experience.
//
// Storage key: `gdpv.viewAs` in localStorage, JSON of ViewAsState + expiry.
// Auto-expires after 8 hours.

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";

const STORAGE_KEY = "gdpv.viewAs";
const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export type ViewAsState = {
  role: "country_user";
  country_code: string;
  expires_at: number;
};

function read(): ViewAsState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewAsState;
    if (!parsed?.country_code || !parsed.expires_at) return null;
    if (Date.now() > parsed.expires_at) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function write(state: ViewAsState | null) {
  if (typeof window === "undefined") return;
  if (!state) window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // Notify same-tab listeners; storage events only fire in other tabs.
  window.dispatchEvent(new CustomEvent("gdpv:view-as-changed"));
}

export function useImpersonation() {
  const [state, setState] = useState<ViewAsState | null>(() => read());
  useEffect(() => {
    const sync = () => setState(read());
    window.addEventListener("storage", sync);
    window.addEventListener("gdpv:view-as-changed", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("gdpv:view-as-changed", sync as EventListener);
    };
  }, []);

  const enter = useCallback((country_code: string) => {
    write({
      role: "country_user",
      country_code: country_code.toUpperCase(),
      expires_at: Date.now() + TTL_MS,
    });
  }, []);

  const exit = useCallback(() => {
    write(null);
  }, []);

  return { state, enter, exit, active: !!state };
}

export function ViewAsBanner() {
  const { state, exit } = useImpersonation();
  const navigate = useNavigate();
  if (!state) return null;
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-amber-400 bg-amber-100 px-6 py-2 text-[12px] text-amber-950">
      <div className="flex items-center gap-2 font-mono uppercase tracking-[0.2em]">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-600" />
        Viewing as country user · {state.country_code}
      </div>
      <button
        onClick={() => {
          exit();
          navigate({ to: "/home" });
        }}
        className="border border-amber-700 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-amber-700 hover:text-amber-50"
      >
        Exit view-as
      </button>
    </div>
  );
}
