// @domain print
// @ui src/components/personas/field/briefing/PrintableBriefing.tsx, src/components/personas/field/deck/DeckModal.tsx, src/components/mandate-compact/plan/PrintablePlan.tsx, src/components/calculator/PrintableValueCase.tsx
//
// One print surface at a time.
//
// Several screens mount more than one printable document simultaneously (the
// commencement briefing and its presentation deck, for example). Each used to
// declare `body * { visibility: hidden }` then force-show its own root with
// `!important`, so neither could hide the other: both absolutely-positioned
// roots stacked on the same sheet and printed on top of each other. `@page`
// is document-global too, so a Letter portrait document and a 16:9 landscape
// deck fought over the sheet size.
//
// The contract here:
//   • every printable renders through <PrintSurface>, which portals it into a
//     single #print-portal node at the end of <body>;
//   • all print roots are display:none until one is explicitly activated;
//   • printSurface(id) activates exactly one root, injects that surface's
//     @page rule, prints, then tears both down on afterprint.

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const PORTAL_ID = "print-portal";
const PAGE_STYLE_ID = "print-page-rule";
const ACTIVE_ATTR = "data-printing";

/** @page + activation CSS per surface id, registered by the mounted surface. */
const pageCssRegistry = new Map<string, string>();

function portalNode(): HTMLElement {
  let node = document.getElementById(PORTAL_ID);
  if (!node) {
    node = document.createElement("div");
    node.id = PORTAL_ID;
    document.body.appendChild(node);
  }
  return node;
}

/** Take down the active surface: remove its page rule and the html flag. */
export function endPrint() {
  if (typeof document === "undefined") return;
  document.documentElement.removeAttribute(ACTIVE_ATTR);
  document.getElementById(PAGE_STYLE_ID)?.remove();
}

/**
 * Print exactly one surface. Activates its root, installs its `@page` rule,
 * optionally swaps the document title so the browser suggests a sensible
 * "Save as PDF" filename, and restores everything when printing ends.
 */
export function printSurface(id: string, options?: { title?: string }) {
  if (typeof window === "undefined") return;

  endPrint();

  const pageCss = pageCssRegistry.get(id) ?? "";
  const style = document.createElement("style");
  style.id = PAGE_STYLE_ID;
  // The activation rule lives here rather than in the global sheet: CSS cannot
  // match "the root whose id equals the html attribute", so we write it out.
  style.textContent = `@media print { [data-print-root="${id}"] { display: block !important; } }\n${pageCss}`;
  document.head.appendChild(style);
  document.documentElement.setAttribute(ACTIVE_ATTR, id);

  const originalTitle = document.title;
  if (options?.title) document.title = options.title;

  const restore = () => {
    document.title = originalTitle;
    endPrint();
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);

  // Let React flush any state the caller set immediately before printing.
  window.setTimeout(() => {
    window.print();
    // Safety net: some browsers never fire afterprint (older Safari, some
    // headless paths). Never leave the page in the printing state.
    window.setTimeout(() => {
      if (document.documentElement.getAttribute(ACTIVE_ATTR) === id) restore();
    }, 1_000);
  }, 120);
}

/**
 * A printable document. Hidden on screen and hidden in print until
 * `printSurface(id)` names it. `pageCss` carries this document's `@page`
 * rules — sheet size, margins, running headers — and is installed only while
 * this surface is the one printing.
 */
export function PrintSurface({
  id,
  rootId,
  pageCss,
  rootProps,
  children,
}: {
  id: string;
  rootId?: string;
  pageCss?: string;
  rootProps?: Record<string, string>;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (pageCss) pageCssRegistry.set(id, pageCss);
    return () => {
      pageCssRegistry.delete(id);
    };
  }, [id, pageCss]);

  if (!mounted) return null;

  return createPortal(
    <div id={rootId} data-print-root={id} {...rootProps}>
      {children}
    </div>,
    portalNode(),
  );
}
