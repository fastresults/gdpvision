// @domain investments
// @tables none
// @ui src/components/investments/packages/PackageDocument.tsx
//
// The shape of every investor package, and of the facts a package is written
// from. Pure: imported by the renderer (admin print view and the public share
// page), by the generator and by the number guard.
//
// Two families of schema live here:
//   • *ContentSchema — what is stored in investment_packages.content and what
//     PackageDocument validates before rendering. Lenient defaults so an older
//     row still renders.
//   • *AiSchema — what the model is asked to return. Constraint-free on
//     purpose (no .min/.max): bounds inside a structured-output schema make an
//     otherwise good gateway call fail as AI_NoObjectGeneratedError. Bounds are
//     stated in the prompt and clamped in code.

import { z } from "zod";

// ------------------------------------------------------------------ facts

export type FactGroup = "project" | "country" | "readiness";

/** One labelled fact. `display` is the only form a document ever prints. */
export interface FactItem {
  key: string;
  label: string;
  group: FactGroup;
  value: string | number | boolean | null;
  display: string;
  unit?: string | null;
  period?: string | null;
  source_url?: string | null;
  /** Readiness only: the standard the check maps to. */
  standard?: string | null;
}

/** Stored verbatim in investment_packages.facts. */
export interface PackageFacts {
  gathered_at: string;
  country_code: string;
  country_name: string;
  project_id: string;
  project_version: number;
  project_title: string;
  items: Record<string, FactItem>;
}

// ------------------------------------------------------------------ shared pieces

export const PACKAGE_KIND_VALUES = ["teaser", "memorandum", "data_room", "deck"] as const;
export type PackageKindValue = (typeof PACKAGE_KIND_VALUES)[number];

export const TO_BE_CONFIRMED = "To be confirmed";
export const CONTACT_PLACEHOLDER = "[Investment authority contact]";

export const DISCLAIMER =
  "This document has been prepared from information supplied by the project sponsor and public statistical sources for the sole purpose of assisting recipients in deciding whether to proceed with further investigation of the project. It does not constitute an offer, invitation or recommendation to invest, and it does not purport to contain all the information a prospective investor may require. Figures are stated as at the period shown against each and have not been independently audited. No representation or warranty, express or implied, is given as to the accuracy or completeness of this document, and no liability is accepted for any loss arising from its use. Recipients should conduct their own due diligence and take their own legal, tax and financial advice.";

const FigureSchema = z.object({
  key: z.string(),
  label: z.string(),
  display: z.string(),
  period: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
});
export type PackageFigure = z.infer<typeof FigureSchema>;

const TermSchema = z.object({ label: z.string(), value: z.string() });

const TableSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  caption: z.string().nullable().optional(),
});
export type PackageTable = z.infer<typeof TableSchema>;

const base = {
  project_title: z.string(),
  country_name: z.string(),
  prepared_on: z.string(),
  /** Numbers in the text that the number guard could not find in the facts. */
  warnings: z.array(z.string()).default([]),
};

// ------------------------------------------------------------------ teaser

export const TeaserContentSchema = z.object({
  kind: z.literal("teaser"),
  ...base,
  headline: z.string(),
  opportunity: z.string(),
  key_terms: z.array(TermSchema),
  key_figures: z.array(FigureSchema).default([]),
  highlights: z.array(z.string()),
  country_context: z.array(
    z.object({
      text: z.string(),
      fact_key: z.string().nullable().optional(),
      figure: FigureSchema.nullable().optional(),
    }),
  ),
  next_steps: z.array(z.string()),
  contact: z.string().default(CONTACT_PLACEHOLDER),
  disclaimer: z.string().default(DISCLAIMER),
});
export type TeaserContent = z.infer<typeof TeaserContentSchema>;

export const TeaserAiSchema = z.object({
  headline: z.string(),
  opportunity: z.string(),
  highlights: z.array(z.string()),
  country_context: z.array(z.object({ text: z.string(), fact_key: z.string().nullish() })),
  next_steps: z.array(z.string()),
});
export type TeaserAi = z.infer<typeof TeaserAiSchema>;

// ------------------------------------------------------------------ memorandum

/** Fixed order. The model writes the paragraphs; the headings and order are ours. */
export const MEMO_SECTIONS = [
  { id: "executive_summary", heading: "Executive summary" },
  { id: "opportunity", heading: "The opportunity" },
  { id: "country_context", heading: "Country and macroeconomic context" },
  { id: "sector_context", heading: "Sector context" },
  { id: "project_description", heading: "Project description" },
  { id: "commercial_structure", heading: "Commercial structure and revenue model" },
  { id: "environmental_social", heading: "Environmental and social" },
  { id: "climate_alignment", heading: "Climate alignment" },
  { id: "risks", heading: "Risks and mitigants" },
  { id: "preparation_status", heading: "Project preparation status" },
  { id: "transaction_process", heading: "Transaction process and next steps" },
  { id: "disclaimer", heading: "Important notice" },
] as const;
export type MemoSectionId = (typeof MEMO_SECTIONS)[number]["id"];

export const MemorandumContentSchema = z.object({
  kind: z.literal("memorandum"),
  ...base,
  sections: z.array(
    z.object({
      id: z.string(),
      heading: z.string(),
      paragraphs: z.array(z.string()),
      table: TableSchema.nullable().optional(),
    }),
  ),
});
export type MemorandumContent = z.infer<typeof MemorandumContentSchema>;

/** One key per section the model writes; the disclaimer is fixed text. */
export const MemorandumAiSchema = z.object({
  executive_summary: z.array(z.string()),
  opportunity: z.array(z.string()),
  country_context: z.array(z.string()),
  sector_context: z.array(z.string()),
  project_description: z.array(z.string()),
  commercial_structure: z.array(z.string()),
  environmental_social: z.array(z.string()),
  climate_alignment: z.array(z.string()),
  risks: z.array(z.object({ risk: z.string(), mitigant: z.string() })),
  risks_intro: z.array(z.string()),
  preparation_status: z.array(z.string()),
  transaction_process: z.array(z.string()),
});
export type MemorandumAi = z.infer<typeof MemorandumAiSchema>;

// ------------------------------------------------------------------ data room

export const DATA_ROOM_STATUSES = ["available", "to_provide", "restricted"] as const;
export type DataRoomStatus = (typeof DATA_ROOM_STATUSES)[number];
export const DATA_ROOM_STATUS_LABEL: Record<DataRoomStatus, string> = {
  available: "Available",
  to_provide: "To provide",
  restricted: "Restricted",
};

export const DataRoomContentSchema = z.object({
  kind: z.literal("data_room"),
  ...base,
  intro: z.string(),
  folders: z.array(
    z.object({
      number: z.string(),
      title: z.string(),
      items: z.array(
        z.object({
          ref: z.string(),
          name: z.string(),
          standard: z.string(),
          required: z.boolean(),
          status: z.enum(DATA_ROOM_STATUSES),
          note: z.string(),
        }),
      ),
    }),
  ),
});
export type DataRoomContent = z.infer<typeof DataRoomContentSchema>;

// ------------------------------------------------------------------ deck

export const DECK_VISUALS = ["none", "illustration", "key_figures"] as const;
export type DeckVisual = (typeof DECK_VISUALS)[number];

export const DeckContentSchema = z.object({
  kind: z.literal("deck"),
  ...base,
  slides: z.array(
    z.object({
      title: z.string(),
      kicker: z.string(),
      bullets: z.array(z.string()),
      fact_keys: z.array(z.string()).default([]),
      visual: z.enum(DECK_VISUALS).default("none"),
      figures: z.array(FigureSchema).default([]),
    }),
  ),
  disclaimer: z.string().default(DISCLAIMER),
});
export type DeckContent = z.infer<typeof DeckContentSchema>;

export const DeckAiSchema = z.object({
  slides: z.array(
    z.object({
      title: z.string(),
      kicker: z.string(),
      bullets: z.array(z.string()),
      fact_keys: z.array(z.string()).nullish(),
      visual: z.string().nullish(),
    }),
  ),
});
export type DeckAi = z.infer<typeof DeckAiSchema>;

// ------------------------------------------------------------------ dispatch

export const CONTENT_SCHEMA = {
  teaser: TeaserContentSchema,
  memorandum: MemorandumContentSchema,
  data_room: DataRoomContentSchema,
  deck: DeckContentSchema,
} as const;

export type PackageContent = TeaserContent | MemorandumContent | DataRoomContent | DeckContent;

/** Validate stored content for a kind. Never throws. */
export function parsePackageContent(
  kind: PackageKindValue,
  content: unknown,
): { ok: true; data: PackageContent } | { ok: false; error: string } {
  const schema = CONTENT_SCHEMA[kind];
  if (!schema) return { ok: false, error: `Unknown package kind: ${String(kind)}` };
  const r = schema.safeParse(content);
  if (r.success) return { ok: true, data: r.data as PackageContent };
  return {
    ok: false,
    error: r.error.issues.map((i) => `${i.path.join(".") || "content"}: ${i.message}`).join("; "),
  };
}

/** Warnings count without a full parse — for list views. */
export function countWarnings(content: unknown): number {
  const w = (content as { warnings?: unknown } | null)?.warnings;
  return Array.isArray(w) ? w.length : 0;
}
