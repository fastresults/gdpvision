# Fix "section could not be drafted" in the Digital Government Studio

## What is happening

- Every Draft click in the PRD editor has failed with: "The section could not be drafted after two attempts. (No object generated: response did not match schema.)"
- The AI writer is not failing: all four calls today returned successfully (about 4,000 words of output each, ~40 s). The app is throwing away good answers because they are not in exactly the shape it expects.
- This is the same fault we fixed for the investor Teaser and Deck, but the section writer never got that fix.

## Why (from the code)

1. **The app asks loosely but checks strictly.** The AI connection is set up without "strict shape" mode, so the model is only told "reply with some JSON". The app then demands exactly four fields (`body_md`, `is_gap`, `gap_reason`, `citations`) with exact types. Any small difference rejects the whole answer.
2. **Long markdown inside JSON is fragile.** The section text is 350–900 words of markdown with tables and bullets, all packed into one JSON string. Typical slips: a missing `gap_reason`, citations given as plain keys instead of `{key, why}`, `is_gap` as the text "false", the answer wrapped in an extra layer, or a code fence around it.
3. **The rescue step is too narrow.** When the check fails, the fallback re-runs the same strict check on the raw text, so it fails for the same reason. Both attempts fail and the user sees the error.
4. **We can't see the bad answers.** The failure log keeps only the first 300 characters of the error, not what the model actually sent, so the exact slip is still unconfirmed.

## The fix

1. **Record the evidence first.** On a failed attempt, log the finish reason, answer length, and the start and end of the raw text. Then run one draft to confirm which slip is happening.
2. **Repair small slips instead of rejecting.** Reuse the lenient repair from the investor-materials writer: strip code fences, unwrap an extra outer layer, fill missing text fields with "", accept "true"/"false", and turn plain citation keys into `{key, why: ""}`.
3. **Ask for the exact shape.** Turn on strict shape mode for this writer only, so the model is told the exact structure up front.
4. **Keep the safeguards.** Citations are still limited to real context keys, a section with no valid citations is still marked a gap, and the one retry stays. The error message still asks the user to try again.
5. **Check it.** Draft section 1 on the Antigua PRD in a test browser, then draft the next section that depends on it. Confirm the text, citations and status read back in the editor.

## Technical details

- File: `src/lib/egov/draft.functions.ts` only.
- Move `coerce` / `parseLenient` / `parseFallback` out of `src/lib/investments/packages.functions.ts` into a shared server helper (e.g. `src/lib/ai-json.server.ts`) and use it in both writers, so neither drifts again.
- Call `createLovableAiGatewayProvider(apiKey, { structuredOutputs: true })` in the egov `draft()`.
- In the catch, log `finishReason`, `text.length`, `text.slice(0,400)`, `text.slice(-400)`, and `cause`, as the packages writer already does.
- No database or UI changes. The model stays as currently set (`google/gemini-2.5-pro`, overridable with `EGOV_MODEL`).
