// @domain mandate-compact
// @tables country_parties
// @ui src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx
//
// Chamber 08 · Mandate Compact — AI-first manifesto extraction.
// Accepts a file (PDF/DOCX/TXT), URL, or pasted text. Extracts raw text,
// then uses Gemini to pre-fill the Compact fields. No DB writes — read-only.

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ExtractInput = z.object({
  countryCode: z.string().min(2).max(3),
  fileBase64: z.string().optional(),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  pastedText: z.string().max(500_000).optional(),
});

const ExtractedSchema = z.object({
  election_cycle: z.string().describe("e.g. '2025-2030'"),
  title: z.string().describe("Manifesto title"),
  pm_name: z.string().describe("Prime Minister / party leader name; empty string if unknown"),
  governing_party: z.string().describe("Name of the party issuing the manifesto; empty string if unknown"),
  summary: z.string().describe("2-3 sentence executive summary, <= 600 chars"),
  pillars_preview: z.array(z.string()).describe("Top 5-8 pillar/theme names as short phrases"),
});

export type ManifestoExtracted = z.infer<typeof ExtractedSchema>;

export type ExtractManifestoResult = {
  extracted: ManifestoExtracted;
  rawText: string;
  charCount: number;
  sourceUrl: string | null;
  matchedPartyId: string | null;
  matchedPartyName: string | null;
  textSource: "file" | "url" | "pasted";
};

const MODEL = "google/gemini-3.6-flash";

export const extractManifesto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data, context }): Promise<ExtractManifestoResult> => {
    console.info("[mandate-compact/extract] received", {
      countryCode: data.countryCode,
      hasFileBase64: Boolean(data.fileBase64),
      pastedChars: data.pastedText?.length ?? 0,
      hasUrl: Boolean(data.sourceUrl),
      mimeType: data.mimeType ?? null,
      filename: data.filename ?? null,
    });

    const { supabase, userId } = context;
    const { data: allowed, error: aErr } = await supabase.rpc("has_country_access", {
      _user_id: userId,
      _country_code: data.countryCode,
    });
    if (aErr) throw new Error(`authorization check failed: ${aErr.message}`);
    if (!allowed) throw new Error("Forbidden: no access to this country");

    // 1) Acquire raw text.
    let rawText = "";
    let sourceUrl: string | null = data.sourceUrl ?? null;
    let textSource: "file" | "url" | "pasted" = "pasted";

    if (data.fileBase64) {
      textSource = "file";
      const bytes = Buffer.from(data.fileBase64, "base64");
      const name = (data.filename ?? "").toLowerCase();
      const mime = (data.mimeType ?? "").toLowerCase();
      try {
        if (mime === "application/pdf" || name.endsWith(".pdf")) {
          let pdfParse: any;
          try {
            pdfParse = await import("pdf-parse" as any).then((m: any) => m.default ?? m);
          } catch (impErr) {
            throw new Error(
              `PDF parsing isn't available in this runtime (${(impErr as Error).message}). Paste the manifesto URL or drop a DOCX/TXT instead.`,
            );
          }
          const out = await pdfParse(bytes);
          rawText = String(out?.text ?? "");
        } else if (
          mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          name.endsWith(".docx")
        ) {
          let mammoth: any;
          try {
            mammoth = await import("mammoth" as any);
          } catch (impErr) {
            throw new Error(
              `DOCX parsing isn't available in this runtime (${(impErr as Error).message}). Paste the manifesto URL or drop a PDF/TXT instead.`,
            );
          }
          const out = await mammoth.extractRawText({ buffer: bytes });
          rawText = String(out?.value ?? "");
        } else if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
          rawText = bytes.toString("utf8");
        } else {
          throw new Error(`Unsupported file type: ${mime || name}. Use PDF, DOCX, or TXT.`);
        }
      } catch (err) {
        throw new Error(`File parse failed: ${(err as Error).message}`);
      }

    } else if (data.sourceUrl) {
      textSource = "url";
      try {
        const { fetchFirecrawl } = await import("@/lib/country-onboarding/ingest.server");
        const doc = await fetchFirecrawl(data.sourceUrl);
        rawText = doc.markdown ?? "";
        sourceUrl = doc.url ?? data.sourceUrl;
      } catch (err) {
        throw new Error(`URL fetch failed: ${(err as Error).message}`);
      }
    } else if (data.pastedText) {
      textSource = data.filename || data.mimeType ? "file" : "pasted";
      rawText = data.pastedText;
    } else {
      throw new Error("Provide a file, URL, or pasted text.");
    }

    rawText = rawText.replace(/\r\n/g, "\n").trim();
    if (rawText.length < 200) {
      throw new Error(`Extracted only ${rawText.length} chars — manifesto too short or unreadable.`);
    }

    // 2) AI extraction — for normal manifesto lengths, send the whole readable
    // text. For very large files, keep the opening, evenly sampled middle, and
    // closing so the model sees the actual policy sections, not just the cover
    // page / table of contents.
    const EXCERPT_LIMIT = 150_000;
    let excerpt = rawText;
    if (rawText.length > EXCERPT_LIMIT) {
      const head = rawText.slice(0, 45_000);
      const tail = rawText.slice(-35_000);
      const middleBudget = EXCERPT_LIMIT - head.length - tail.length;
      const slices: string[] = [];
      const sliceCount = 4;
      const sliceSize = Math.floor(middleBudget / sliceCount);
      for (let i = 1; i <= sliceCount; i += 1) {
        const center = Math.floor((rawText.length * i) / (sliceCount + 1));
        const start = Math.max(0, center - Math.floor(sliceSize / 2));
        slices.push(rawText.slice(start, start + sliceSize));
      }
      excerpt = [head, ...slices, tail].join("\n\n[…sampled manifesto section…]\n\n");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    let extracted: ManifestoExtracted;
    try {
      const result: any = await generateText({
        model: gateway(MODEL),
        experimental_output: Output.object({ schema: ExtractedSchema }) as any,
        system:
          "You are a policy analyst reading a party manifesto for country " +
          data.countryCode +
          ". Extract the requested fields precisely from the document itself. " +
          "Use empty strings for unknowns rather than inventing values. " +
          "For pillars_preview, you must return 5-8 short phrases (<= 60 chars each). Prefer the document's own section titles / thematic headings; if explicit headings are absent, synthesize concise policy pillar names grounded in repeated commitments from the text. " +
          "Summary must be 2-3 sentences, <= 600 characters.",
        prompt: `MANIFESTO EXCERPT (may be truncated):\n\n${excerpt}`,
      } as any);
      extracted = (result?.experimental_output ?? result?.output) as ManifestoExtracted;
      if (typeof extracted === "string") {
        const raw = (extracted as string).trim().replace(/^`+\s*(?:json)?\s*/i, "").replace(/`+\s*$/i, "").trim();
        try {
          extracted = JSON.parse(raw) as ManifestoExtracted;
        } catch {
          const m = raw.match(/\{[\s\S]*\}/);
          if (!m) throw new Error("model returned non-JSON output");
          extracted = JSON.parse(m[0]) as ManifestoExtracted;
        }
      }
      if (extracted && typeof extracted === "object" && "extracted" in extracted) {
        const nested = (extracted as { extracted?: unknown }).extracted;
        if (nested && typeof nested === "object") extracted = nested as ManifestoExtracted;
      }
      if (!extracted || typeof extracted !== "object") throw new Error("empty extraction");
    } catch (err) {
      throw new Error(`AI extraction failed: ${(err as Error).message}`);
    }

    const inferredPillars = (() => {
      const text = rawText.toLowerCase();
      const catalog: Array<[string, RegExp]> = [
        ["Economic growth and jobs", /\b(job|employment|entrepreneur|business|investment|economic growth|small business|enterprise)\b/i],
        ["Tourism and investment", /\b(tourism|visitor|hotel|cruise|hospitality|foreign direct investment|investor)\b/i],
        ["Housing and infrastructure", /\b(housing|homes|infrastructure|roads|water|ports|airport|utilities|construction)\b/i],
        ["Health and social protection", /\b(health|hospital|clinic|medical|wellness|social protection|elderly|disability|pension)\b/i],
        ["Education, youth and skills", /\b(education|school|teacher|student|youth|training|skills|scholarship|university)\b/i],
        ["Agriculture and food security", /\b(agriculture|farm|fisher|food security|livestock|crop|fisheries)\b/i],
        ["Climate resilience and energy", /\b(climate|resilience|renewable|solar|energy|environment|hurricane|sustainability|green)\b/i],
        ["Security and justice", /\b(security|crime|police|justice|court|border|defence|safety)\b/i],
        ["Digital government", /\b(digital|technology|broadband|e-government|online|data|innovation)\b/i],
        ["Governance and fiscal discipline", /\b(governance|transparency|accountability|fiscal|debt|tax|public service|reform)\b/i],
      ];
      const matches = catalog.filter(([, re]) => re.test(text)).map(([label]) => label);
      return (matches.length >= 5 ? matches : [
        ...matches,
        "Economic transformation",
        "Human capital",
        "Public service delivery",
        "National resilience",
        "Inclusive prosperity",
      ]).filter((item, idx, arr) => arr.indexOf(item) === idx).slice(0, 8);
    })();

    // Clamp to declared caps.
    const maybeExtracted = extracted as ManifestoExtracted & { pillars?: unknown; themes?: unknown; priorities?: unknown };
    const modelPillars = Array.isArray(maybeExtracted.pillars_preview)
      ? maybeExtracted.pillars_preview
      : Array.isArray(maybeExtracted.pillars)
        ? maybeExtracted.pillars
        : Array.isArray(maybeExtracted.themes)
          ? maybeExtracted.themes
          : Array.isArray(maybeExtracted.priorities)
            ? maybeExtracted.priorities
            : [];
    extracted.summary = (extracted.summary ?? "").slice(0, 600);
    extracted.title = (extracted.title ?? data.filename ?? "Manifesto").slice(0, 300);
    extracted.pm_name = (extracted.pm_name ?? "").slice(0, 200);
    extracted.governing_party = (extracted.governing_party ?? "").slice(0, 200);
    extracted.election_cycle = (extracted.election_cycle || rawText.match(/\b(20\d{2}\s*[-–—]\s*20\d{2})\b/)?.[1] || "Current term").slice(0, 64);
    extracted.pillars_preview = modelPillars
      .filter((p) => typeof p === "string" && p.trim().length > 0)
      .slice(0, 8)
      .map((p) => p.slice(0, 80));
    if (extracted.pillars_preview.length < 5) {
      extracted.pillars_preview = inferredPillars;
      console.info("[mandate-compact/extract] inferred pillars fallback", {
        countryCode: data.countryCode,
        filename: data.filename ?? null,
        pillars: extracted.pillars_preview.length,
      });
    }

    // 3) Best-effort party match against country_parties.
    let matchedPartyId: string | null = null;
    let matchedPartyName: string | null = null;
    if (extracted.governing_party) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: parties } = await supabaseAdmin
        .from("country_parties")
        .select("id, name, is_ruling")
        .eq("country_code", data.countryCode);
      const target = extracted.governing_party.toLowerCase();
      const exact = parties?.find((p) => (p.name as string).toLowerCase() === target);
      const partial = parties?.find(
        (p) =>
          (p.name as string).toLowerCase().includes(target) ||
          target.includes((p.name as string).toLowerCase()),
      );
      const hit = exact ?? partial;
      if (hit) {
        matchedPartyId = hit.id as string;
        matchedPartyName = hit.name as string;
      }
    }

    return {
      extracted,
      rawText,
      charCount: rawText.length,
      sourceUrl,
      matchedPartyId,
      matchedPartyName,
      textSource,
    };
  });
