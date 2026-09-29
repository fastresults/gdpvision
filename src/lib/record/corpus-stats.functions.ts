// @domain marketing
// @tables country_sources,country_source_chunks,country_kpis
// @ui src/routes/record.tsx
//
// Public aggregate counts for the National Record page. No auth: counts over
// public rows only (see corpus-stats.server.ts).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getCorpusStats = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const code = typeof d === "object" && d !== null ? (d as { code?: string | null }).code : null;
    return {
      code: code
        ? z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z]{3}$/)
            .parse(code)
        : null,
    };
  })
  .handler(async ({ data }) => {
    const { computeCorpusStats } = await import("./corpus-stats.server");
    return computeCorpusStats(data.code);
  });
