// @domain executive
// @tables none
// @ui src/components/executive/chamber/*
//
// Slug ↔ chamber index ↔ working-chamber route. The Chamber Room Sheet is
// addressed by slug so a Principal can bookmark, print, or forward the URL.

import type { ChamberRoute } from "./types";

export interface ChamberSlugEntry {
  slug: string;
  index: string;
  to: ChamberRoute;
}

export const CHAMBER_SLUGS: ChamberSlugEntry[] = [
  { slug: "ledger", index: "01", to: "/admin/countries/$code/ledger" },
  { slug: "portfolio", index: "02", to: "/admin/countries/$code/portfolio" },
  { slug: "scenarios", index: "03", to: "/admin/countries/$code/scenarios" },
  { slug: "studio", index: "04", to: "/admin/countries/$code/studio" },
  { slug: "narrative", index: "05", to: "/admin/countries/$code/narrative" },
  { slug: "cabinet", index: "06", to: "/admin/countries/$code/cabinet" },
  { slug: "personas", index: "07", to: "/admin/countries/$code/personas" },
  { slug: "mandate-compact", index: "08", to: "/admin/countries/$code/mandate-compact" },
];

export function slugForIndex(index: string): string {
  return CHAMBER_SLUGS.find((c) => c.index === index)?.slug ?? "ledger";
}

export function indexForSlug(slug: string): string | null {
  return CHAMBER_SLUGS.find((c) => c.slug === slug)?.index ?? null;
}

/** Which shell the sheet lives in — the two surfaces render the same component. */
export type ExecutiveSurface = "console" | "admin";

export type SheetRoute =
  | "/console/$code/chamber/$chamber"
  | "/admin/countries/$code/executive/chamber/$chamber";

export function sheetRoute(surface: ExecutiveSurface): SheetRoute {
  return surface === "admin"
    ? "/admin/countries/$code/executive/chamber/$chamber"
    : "/console/$code/chamber/$chamber";
}

export type BriefRoute = "/console/$code" | "/admin/countries/$code/executive";

export function briefRoute(surface: ExecutiveSurface): BriefRoute {
  return surface === "admin" ? "/admin/countries/$code/executive" : "/console/$code";
}
