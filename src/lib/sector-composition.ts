// Sector composition helper used by the National Signature ring
// (PRD §10.3). Accepts a country_sectors payload and produces a
// normalized, ordered composition for rendering. Client-safe.

import { CANONICAL_SECTORS, type CanonicalSector } from "./caricom-registry";

export interface SectorShare {
  sector: CanonicalSector;
  sharePct: number;
  confidenceGrade?: "A" | "B" | "C" | "D";
}

export interface Composition {
  countryCode: string;
  shares: SectorShare[];
  /** Sum of raw shares (may be <100 if data is incomplete — never silently rescaled). */
  totalPct: number;
}

/** Compose a per-nation ring from a raw {sector_code, share_pct} list. */
export function composeFromRows(
  countryCode: string,
  rows: Array<{ sector_code: string; share_pct: number; confidence_grade?: string }>,
): Composition {
  const bySector = new Map(rows.map((r) => [r.sector_code, r] as const));
  const shares: SectorShare[] = CANONICAL_SECTORS.map((sector) => {
    const row = bySector.get(sector.slug);
    return {
      sector,
      sharePct: row?.share_pct ?? 0,
      confidenceGrade: (row?.confidence_grade as SectorShare["confidenceGrade"]) ?? undefined,
    };
  });
  const totalPct = shares.reduce((s, x) => s + x.sharePct, 0);
  return { countryCode, shares, totalPct };
}

/** Idealized balanced ring — the product master mark. */
export function balancedComposition(): Composition {
  const shares: SectorShare[] = CANONICAL_SECTORS.map((sector) => ({
    sector,
    sharePct: 100 / CANONICAL_SECTORS.length,
    confidenceGrade: "A",
  }));
  return { countryCode: "MASTER", shares, totalPct: 100 };
}
