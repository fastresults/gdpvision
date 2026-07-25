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
          const pdfParse: any = await import("pdf-parse" as any).then((m: any) => m.default ?? m);
          const out = await pdfParse(bytes);
          rawText = String(out?.text ?? "");
        } else if (
          mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          name.endsWith(".docx")
        ) {
          const mammoth: any = await import("mammoth" as any);
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
      textSource = "pasted";
      rawText = data.pastedText;
    } else {
      throw new Error("Provide a file, URL, or pasted text.");
    }

    rawText = rawText.replace(/\r\n/g, "\n").trim();
    if (rawText.length < 200) {
      throw new Error(`Extracted only ${rawText.length} chars — manifesto too short or unreadable.`);
    }

    // 2) AI extraction — send a large but capped window so it stays under
    // token limits while catching cover-page, TOC, and closing sections.
    const HEAD = 40_000;
    const TAIL = 12_000;
    const excerpt =
      rawText.length <= HEAD + TAIL
        ? rawText
        : `${rawText.slice(0, HEAD)}\n\n[…truncated…]\n\n${rawText.slice(-TAIL)}`;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);

    let extracted: ManifestoExtracted;
    try {
      const { experimental_output } = await generateText({
        model: gateway(MODEL),
        output: Output.object({ schema: ExtractedSchema }),
        system:
          "You are a policy analyst reading a party manifesto for country " +
          data.countryCode +
          ". Extract the requested fields precisely from the document itself. " +
          "Use empty strings for unknowns rather than inventing values. " +
          "For pillars, prefer the document's own section titles / thematic headings; return 5-8 short phrases (<= 60 chars each). " +
          "Summary must be 2-3 sentences, <= 600 characters.",
        prompt: `MANIFESTO EXCERPT (may be truncated):\n\n${excerpt}`,
      });
      extracted = experimental_output;
    } catch (err) {
      throw new Error(`AI extraction failed: ${(err as Error).message}`);
    }

    // Clamp to declared caps.
    extracted.summary = (extracted.summary ?? "").slice(0, 600);
    extracted.title = (extracted.title ?? "").slice(0, 300);
    extracted.pm_name = (extracted.pm_name ?? "").slice(0, 200);
    extracted.governing_party = (extracted.governing_party ?? "").slice(0, 200);
    extracted.election_cycle = (extracted.election_cycle ?? "").slice(0, 64);
    extracted.pillars_preview = (extracted.pillars_preview ?? [])
      .filter((p) => typeof p === "string" && p.trim().length > 0)
      .slice(0, 8)
      .map((p) => p.slice(0, 80));

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
