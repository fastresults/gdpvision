import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Fit only the diagram; the reading tray must remain outside this canvas. */
export function FlowDiagramStage({
  fitted,
  children,
}: {
  fitted: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ scale: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const host = ref.current;
    if (!host || !fitted) return;
    const update = () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        setFit(null);
        return;
      }
      const scale = Math.min(1, host.clientWidth / 1040, host.clientHeight / 760);
      setFit({ scale, left: Math.max(0, (host.clientWidth - 1040 * scale) / 2) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [fitted]);

  return (
    <div
      ref={ref}
      data-flow-stage
      className={cn(
        "relative flex min-w-0 flex-col md:min-h-0 md:flex-1",
        fitted && "lg:h-full lg:overflow-hidden",
      )}
    >
      <div
        className="flex min-w-0 flex-col md:h-full md:min-h-0"
        style={fit ? {
          position: "absolute",
          top: 0,
          left: fit.left,
          width: 1040,
          height: 760,
          transformOrigin: "top left",
          transform: `scale(${fit.scale})`,
        } : undefined}
      >
        {children}
      </div>
    </div>
  );
}