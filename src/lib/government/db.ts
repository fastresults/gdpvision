// @domain government
// @tables government_offices,statutory_bodies
// @ui src/routes/_authenticated/admin/countries.$code.government.tsx
//
// Row shapes for the machinery-of-government record (drizzle/migrations/0022):
// offices of state and Cabinet, and statutory bodies. Read by the PRD context
// packs (chamber 09), the Sector Studio (chamber 10) and the public API's
// `government` resource. Only verified + public rows leave GDPVision.

export type MachineryStatus = "draft" | "verified" | "retired";
export type Visibility = "public" | "private";
export type Confidence = "low" | "medium" | "high";
export type Origin = "research" | "backfill" | "manual";

export const OFFICE_KEYS = [
  "head_of_state",
  "governor_general",
  "head_of_government",
  "deputy_head_of_government",
  "cabinet_minister",
  "minister_of_state",
  "attorney_general",
  "parliamentary_secretary",
  "cabinet_secretary",
  "speaker",
  "president_of_senate",
  "leader_of_opposition",
  "other",
] as const;
export type OfficeKey = (typeof OFFICE_KEYS)[number];

export const OFFICE_LABEL: Record<OfficeKey, string> = {
  head_of_state: "Head of State",
  governor_general: "Governor-General",
  head_of_government: "Head of Government",
  deputy_head_of_government: "Deputy Head of Government",
  cabinet_minister: "Cabinet Minister",
  minister_of_state: "Minister of State",
  attorney_general: "Attorney General",
  parliamentary_secretary: "Parliamentary Secretary",
  cabinet_secretary: "Cabinet Secretary",
  speaker: "Speaker",
  president_of_senate: "President of the Senate",
  leader_of_opposition: "Leader of the Opposition",
  other: "Other office",
};

/** Default order of precedence when the source gives none. */
export const OFFICE_PRECEDENCE: Record<OfficeKey, number> = {
  head_of_state: 1,
  governor_general: 2,
  head_of_government: 3,
  deputy_head_of_government: 4,
  attorney_general: 10,
  cabinet_minister: 20,
  minister_of_state: 40,
  parliamentary_secretary: 50,
  cabinet_secretary: 60,
  speaker: 70,
  president_of_senate: 71,
  leader_of_opposition: 80,
  other: 90,
};

export const BODY_KINDS = [
  "statutory_body",
  "authority",
  "commission",
  "board",
  "regulator",
  "corporation",
  "state_owned_enterprise",
  "agency",
  "fund",
  "other",
] as const;
export type BodyKind = (typeof BODY_KINDS)[number];

export const BODY_KIND_LABEL: Record<BodyKind, string> = {
  statutory_body: "Statutory body",
  authority: "Authority",
  commission: "Commission",
  board: "Board",
  regulator: "Regulator",
  corporation: "Corporation",
  state_owned_enterprise: "State-owned enterprise",
  agency: "Agency",
  fund: "Fund",
  other: "Other",
};

export interface Citation {
  url: string;
  title?: string | null;
}

export interface OfficeContact {
  office_phone?: string | null;
  email?: string | null;
  office_address?: string | null;
  website?: string | null;
}

export interface OfficeRow {
  id: string;
  country_code: string;
  office_key: OfficeKey;
  title: string;
  holder_name: string | null;
  ministry_slug: string | null;
  portfolio: string;
  precedence: number;
  party: string | null;
  appointed_on: string | null;
  portrait_url: string | null;
  bio: string | null;
  contact: OfficeContact;
  source_url: string | null;
  citations: Citation[];
  confidence: Confidence;
  origin: Origin;
  status: MachineryStatus;
  visibility: Visibility;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BodyRow {
  id: string;
  country_code: string;
  slug: string;
  name: string;
  acronym: string | null;
  kind: BodyKind;
  parent_ministry_slug: string | null;
  enabling_act: string | null;
  act_year: number | null;
  mandate: string;
  head_name: string | null;
  head_title: string | null;
  board_chair: string | null;
  sector_code: string | null;
  services: string[];
  website: string | null;
  contact: OfficeContact;
  source_url: string | null;
  citations: Citation[];
  confidence: Confidence;
  origin: Origin;
  status: MachineryStatus;
  visibility: Visibility;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** The public shape of the record, as the API serves it and the PRD packs read it. */
export interface GovernmentDirectory {
  head_of_state: PublicOffice | null;
  head_of_government: PublicOffice | null;
  deputy_head_of_government: PublicOffice | null;
  cabinet: PublicOffice[];
  other_offices: PublicOffice[];
  ministries: Array<{ slug: string; name: string; minister: string | null; bodies: string[] }>;
  statutory_bodies: PublicBody[];
}

export interface PublicOffice {
  id: string;
  office: OfficeKey;
  title: string;
  holder: string | null;
  portfolio: string;
  ministry_slug: string | null;
  precedence: number;
  party: string | null;
  appointed_on: string | null;
  portrait_url: string | null;
  bio: string | null;
  contact: OfficeContact;
  source_url: string | null;
  updated_at: string;
}

export interface PublicBody {
  id: string;
  slug: string;
  name: string;
  acronym: string | null;
  kind: BodyKind;
  parent_ministry_slug: string | null;
  enabling_act: string | null;
  act_year: number | null;
  mandate: string;
  head: { name: string | null; title: string | null };
  board_chair: string | null;
  sector_code: string | null;
  services: string[];
  website: string | null;
  contact: OfficeContact;
  source_url: string | null;
  updated_at: string;
}

export function toPublicOffice(o: OfficeRow): PublicOffice {
  return {
    id: o.id,
    office: o.office_key,
    title: o.title,
    holder: o.holder_name,
    portfolio: o.portfolio,
    ministry_slug: o.ministry_slug,
    precedence: o.precedence,
    party: o.party,
    appointed_on: o.appointed_on,
    portrait_url: o.portrait_url,
    bio: o.bio,
    contact: o.contact ?? {},
    source_url: o.source_url,
    updated_at: o.updated_at,
  };
}

export function toPublicBody(b: BodyRow): PublicBody {
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    acronym: b.acronym,
    kind: b.kind,
    parent_ministry_slug: b.parent_ministry_slug,
    enabling_act: b.enabling_act,
    act_year: b.act_year,
    mandate: b.mandate,
    head: { name: b.head_name, title: b.head_title },
    board_chair: b.board_chair,
    sector_code: b.sector_code,
    services: Array.isArray(b.services) ? b.services : [],
    website: b.website,
    contact: b.contact ?? {},
    source_url: b.source_url,
    updated_at: b.updated_at,
  };
}

/** Assemble the directory from verified + public rows (callers filter). */
export function buildDirectory(
  offices: OfficeRow[],
  bodies: BodyRow[],
  ministries: Array<{ slug: string; name: string }>,
): GovernmentDirectory {
  const pub = [...offices].sort((a, b) => a.precedence - b.precedence).map(toPublicOffice);
  const first = (k: OfficeKey) => pub.find((o) => o.office === k) ?? null;
  const cabinetKeys = new Set<OfficeKey>([
    "head_of_government",
    "deputy_head_of_government",
    "cabinet_minister",
    "attorney_general",
  ]);
  const bodiesPub = bodies.map(toPublicBody).sort((a, b) => a.name.localeCompare(b.name));
  return {
    head_of_state: first("governor_general") ?? first("head_of_state"),
    head_of_government: first("head_of_government"),
    deputy_head_of_government: first("deputy_head_of_government"),
    cabinet: pub.filter((o) => cabinetKeys.has(o.office)),
    other_offices: pub.filter(
      (o) =>
        !cabinetKeys.has(o.office) &&
        o.office !== "head_of_state" &&
        o.office !== "governor_general",
    ),
    ministries: ministries.map((m) => ({
      slug: m.slug,
      name: m.name,
      minister:
        pub.find((o) => o.ministry_slug === m.slug && cabinetKeys.has(o.office))?.holder ?? null,
      bodies: bodiesPub.filter((b) => b.parent_ministry_slug === m.slug).map((b) => b.slug),
    })),
    statutory_bodies: bodiesPub,
  };
}
