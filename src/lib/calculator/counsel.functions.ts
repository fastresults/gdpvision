// @domain marketing
// @tables none
// @ui src/components/calculator/CounselPanel.tsx
//
// AI counsel for the Sovereign Value Instrument. Public by design — this is a
// marketing surface with no PII in the payload. The arithmetic never waits on
// this call; if it fails, the calculator stands unchanged.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { FALLBACK_COUNSEL, generateCounsel, type Counsel } from "./counsel.server";

const inputSchema = z.object({
  country: z.string().trim().max(120),
  gdpUsd: z.number().nonnegative().max(1e14),
  stance: z.string().trim().max(32),
  upliftUsd: z.number().nonnegative().max(1e14),
  upliftPpOfGdp: z.number(),
  returnMultiple: z.number(),
  paybackMonths: z.number().nullable(),
  latencyMonths: z.number(),
  unmeasuredPct: z.number(),
  topSectorSharePct: z.number(),
  decisionsPerQuarter: z.number(),
  highestLeverage: z.string().nullable(),
  chambers: z
    .array(
      z.object({
        index: z.string().max(4),
        short: z.string().max(64),
        adoption: z.number(),
        usd: z.number(),
        mechanism: z.string().max(240),
      }),
    )
    .max(12),
});

export type CounselResponse =
  | { ok: true; counsel: Counsel; degraded?: boolean }
  | { ok: false; error: string };

export const getValueCounsel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<CounselResponse> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false, error: "DEBUG NOKEY" };

    try {
      const counsel = await generateCounsel(key, data);
      return { ok: true, counsel };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("429")) return { ok: false, error: "The counsel service is busy. The arithmetic below is unaffected." };
      if (message.includes("402")) return { ok: false, error: "The counsel service is unavailable. The arithmetic below is unaffected." };
      console.error("[calculator] counsel failed", error);
      return { ok: false, error: `DEBUG ${message.slice(0, 400)}` };
      return { ok: true, counsel: FALLBACK_COUNSEL, degraded: true };
    }
  });
