import { useRef, type ReactNode } from "react";
import { useScrollToTopOnChange } from "@/hooks/useScrollToTopOnChange";

/**
 * Drop-in wrapper that scrolls its container to the top of the viewport
 * whenever `dep` changes (e.g. active tab, wizard step, selected item).
 *
 * Usage:
 *   <ScrollAnchor dep={activeTab}>
 *     {renderTab(activeTab)}
 *   </ScrollAnchor>
 */
export function ScrollAnchor({
  dep,
  children,
  offset = 72,
  behavior = "smooth",
  className,
}: {
  dep: unknown;
  children: ReactNode;
  offset?: number;
  behavior?: ScrollBehavior;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useScrollToTopOnChange(ref, dep, { offset, behavior });
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
