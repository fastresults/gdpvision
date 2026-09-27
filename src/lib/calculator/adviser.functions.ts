// @domain marketing
// @tables none
// @ui src/components/brief/AdviserBox.tsx
//
// Public: the Decision Brief's adviser. The payload is the visitor's question
// and the brief's own public facts and model output — no personal data. Rate
// limited per caller; if the gateway is absent or busy the brief is unchanged.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { allowQuestion, askAdviser, type AdviserAnswer } from "./adviser.server";

const s = (n: number) => z.string().trim().max(n);

const inputSchema = z.object({
  question: z.string().trim().min(3).max(500),
  context: z.object({
    country: s(120),
    region: s(32),
    facts: z
      .array(
        z.object({
          key: s(40),
          label: s(120),
          display: s(200),
          grade: s(16),
          source: s(120),
          regional: s(80).nullable(),
        }),
      )
      .max(16),
    inputs: z.record(s(40), z.union([z.number(), s(32)])),
    verdict: z.object({
      uplift_usd: z.number(),
      pp_of_gdp: z.number(),
      ceiling_usd: z.number(),
      raw_usd: z.number(),
      return_multiple: z.number(),
      payback_months: z.number().nullable(),
      annual_cost_usd: z.number(),
      year_one_cost_usd: z.number(),
      term_months: z.number(),
    }),
    sequence: z
      .array(
        z.object({
          index: s(4),
          title: s(80),
          adoption: z.number(),
          usd: z.number(),
          why: s(400),
        }),
      )
      .max(12),
  }),
});

export type AdviserResponse = { ok: true; answer: AdviserAnswer } | { ok: false; error: string };

export const askBriefAdviser = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<AdviserResponse> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key)
      return { ok: false, error: "The adviser is not configured. The brief is unaffected." };

    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const caller =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0] ??
      "anon";
    if (!allowQuestion(caller.trim()))
      return { ok: false, error: "That is the limit for now. Try again in a few minutes." };

    try {
      return { ok: true, answer: await askAdviser(key, data.question, data.context) };
    } catch (error) {
      const m = error instanceof Error ? error.message : "";
      if (m.includes("429") || m.includes("402"))
        return { ok: false, error: "The adviser is busy. The brief is unaffected." };
      console.error("[brief] adviser failed", error);
      return { ok: false, error: "The adviser could not answer that. The brief is unaffected." };
    }
  });
