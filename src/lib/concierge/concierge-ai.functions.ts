// @domain concierge
// @tables —
// @ui src/routes/_authenticated/concierge.new.tsx

// Concierge AI helpers. All requester-facing text is scrubbed through the
// minister lexicon before it leaves the server.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MINISTER_VOICE_SYSTEM,
  enforceMinisterLexicon,
  scrubMinisterPayload,
  LEXICON,
  type ChamberId,
} from "./minister-lexicon";

const MODEL = "google/gemini-2.5-flash";

async function llmJson<T>(system: string, user: string): Promise<T> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Lovable AI Gateway not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 400)}`);
  }
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content) as T;
}

const chamberList = (Object.keys(LEXICON) as ChamberId[])
  .map((id) => `- ${id}: ${LEXICON[id].description}`)
  .join("\n");

const INTERPRET_SYSTEM = `${MINISTER_VOICE_SYSTEM}

You interpret what a Minister is asking for. Return a short, warm,
minister-facing interpretation of their request (2–4 sentences, plain
language, no jargon).

Also return an INTERNAL routing pick — this is not shown to the Minister.
Pick one team from this list:
${chamberList}

Return JSON exactly: {
  "interpretation": "…",     // shown to the Minister
  "internal_chamber": "…",   // one of: ledger, portfolio, scenario, fdi, narrative, cabinet, persona
  "confidence": 0.0–1.0
}
The "interpretation" field MUST NOT contain any banned term. Speak like a
chief of staff.`;

export const interpretIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        raw_text: z.string().min(1).max(20000),
        country_code: z.string().min(2).max(8),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const shape = z.object({
      interpretation: z.string().max(2000),
      internal_chamber: z.enum([
        "ledger",
        "portfolio",
        "scenario",
        "fdi",
        "narrative",
        "cabinet",
        "persona",
      ]),
      confidence: z.number().min(0).max(1),
    });

    let parsed: z.infer<typeof shape>;
    try {
      const raw = await llmJson<unknown>(
        INTERPRET_SYSTEM,
        `Country code: ${data.country_code}\n\nMinister said:\n"""${data.raw_text}"""`,
      );
      parsed = shape.parse(raw);
    } catch (err) {
      // Safe fallback in minister voice.
      return {
        interpretation:
          "I've noted your request. Our team will take this in and come back to you with a written response.",
        internal_chamber: "ledger" as ChamberId,
        confidence: 0.3,
      };
    }

    // Scrub, and if we had to strip anything, ask once more or fall back.
    const lint = enforceMinisterLexicon(parsed.interpretation);
    return {
      interpretation: lint.scrubbed,
      internal_chamber: parsed.internal_chamber,
      confidence: parsed.confidence,
    };
  });

const DRAFT_SYSTEM = `${MINISTER_VOICE_SYSTEM}

You produce a structured REQUEST CARD from a Minister's ask. Return JSON:
{
  "question": "one sentence in the Minister's own voice",
  "why_it_matters": "one or two sentences on the decision this informs",
  "deliverable_shape": "short label of what they will receive back",
  "built_on": ["three short, plain-language sources — no citation ids"],
  "when_needed": "one of: This week | Next week | Whenever fits"
}

All fields MUST be in minister-facing language. Never use banned terms.
"built_on" items describe evidence in plain words, e.g. "your latest
tourism revenue and employment figures", "the country's current fiscal
position", "IMF Article IV consultation notes".`;

export const draftRequestCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        raw_text: z.string().min(1).max(20000),
        country_code: z.string().min(2).max(8),
        internal_chamber: z
          .enum([
            "ledger",
            "portfolio",
            "scenario",
            "fdi",
            "narrative",
            "cabinet",
            "persona",
          ])
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const shape = z.object({
      question: z.string().max(600),
      why_it_matters: z.string().max(1200),
      deliverable_shape: z.string().max(200),
      built_on: z.array(z.string().max(240)).max(6),
      when_needed: z.string().max(80),
    });

    let card: z.infer<typeof shape>;
    try {
      const hint = data.internal_chamber
        ? `\n\nExpected response shape: ${LEXICON[data.internal_chamber].requestShape}`
        : "";
      const raw = await llmJson<unknown>(
        DRAFT_SYSTEM,
        `Country code: ${data.country_code}${hint}\n\nMinister said:\n"""${data.raw_text}"""`,
      );
      card = shape.parse(raw);
    } catch {
      card = {
        question: data.raw_text.split("\n")[0].slice(0, 240),
        why_it_matters: "",
        deliverable_shape: data.internal_chamber
          ? LEXICON[data.internal_chamber].requestShape
          : "A written brief",
        built_on: [
          "the information we have on your country",
          "the latest figures on the topic you mentioned",
        ],
        when_needed: "Next week",
      };
    }
    return scrubMinisterPayload(card);
  });
