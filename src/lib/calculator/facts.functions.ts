// @domain marketing
// @tables countries
// @ui src/components/brief/FactRail.tsx
//
// Public server functions for the Decision Brief: the countries a visitor may
// choose, and the graded facts for one of them. No auth — the facts are
// public by construction (see facts.server.ts for the allow-list).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { CountryFacts } from "./facts.server";

export const getBriefCountries = createServerFn({ method: "GET" }).handler(async () => {
  const { listBriefCountries } = await import("./facts.server");
  return listBriefCountries();
});

export const getCountryFacts = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const code =
      typeof d === "object" && d !== null ? (d as { code?: string }).code : String(d ?? "");
    return {
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/)
        .parse(code),
    };
  })
  .handler(async ({ data }): Promise<CountryFacts | null> => {
    const { computeCountryFacts } = await import("./facts.server");
    return computeCountryFacts(data.code);
  });
