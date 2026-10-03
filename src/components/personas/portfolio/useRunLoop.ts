// Chamber 07 · Ministers track — the run loop. While the page is open and
// the run is going, calls one tick after another; closing the page stops it,
// and the stored phase is where the next visit resumes.

import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { resetPortfolioRun, runPortfolioTick } from "@/lib/personas/portfolio/run.functions";

export function useRunLoop(setId: string, onProgress: () => void) {
  const tick = useServerFn(runPortfolioTick);
  const reset = useServerFn(resetPortfolioRun);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const want = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      want.current = false;
    };
  }, []);

  const start = useCallback(
    async (fromFailed = false) => {
      if (want.current) return;
      want.current = true;
      setRunning(true);
      setError(null);
      try {
        if (fromFailed) await reset({ data: { setId } });
        while (want.current && alive.current) {
          const r = await tick({ data: { setId } });
          if (!alive.current) break;
          setMessage(r.summary);
          onProgress();
          if (r.run_state === "failed") {
            setError(r.error ?? r.summary);
            break;
          }
          if (r.phase === "done") break;
          if (r.busy) await new Promise((res) => setTimeout(res, 8000));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        want.current = false;
        if (alive.current) setRunning(false);
        onProgress();
      }
    },
    [setId, tick, reset, onProgress],
  );

  const stop = useCallback(() => {
    want.current = false;
    setMessage("Stopping after the current step…");
  }, []);

  return { running, message, error, start, stop };
}
