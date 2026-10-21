// Partner-only key permissions (not v1 country resources). Client-safe.
export const PARTNER_EXTRA_SCOPES = ["events_context", "events_register", "indices_test"] as const;
export type PartnerExtraScope = (typeof PARTNER_EXTRA_SCOPES)[number];

export const PARTNER_EXTRA_LABEL: Record<PartnerExtraScope, string> = {
  events_context: "GDP Events: sector figures, Second Brain facts and news for each summit's host country",
  events_register: "GDP Events: send registrations back into Events Admin (write access)",
  indices_test: "Caribbean Indices: read the private TEST edition",
};

/** Permissions a dedicated GDP Events site key needs. */
export const GDP_EVENTS_PRESET = ["events", "media", "events_context", "events_register"] as const;
