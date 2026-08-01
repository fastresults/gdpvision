## What's missing

Today every instrument is drafted strictly against the plan's objectives — each question must carry an `objective_ref`. That makes the instruments faithful to the brief, but it means nothing ever asks the stakeholder the one thing only they can answer: *where does this actually break, and what would you change?* Frontline invention is never elicited, so it never reaches the evidence stage.

## The fix — a standing "Frontline insight" block

Every survey and every discussion guide gains a short, mandatory closing block, drafted by AI to the study's own subject (never boilerplate), and unconditionally verified after drafting so it can't be dropped.

**Survey (self-completion)** — 3 items at the end, after the objective-led questions:
1. Friction: "Thinking about how [subject] works day to day, where does it break down or slow you down most?" (open text)
2. Invention: "If you could change one thing about how this is done, what would you change and what would improve?" (open text)
3. Signal-strength scale: "How confident are you that this change would work?" (1–5) — lets us rank ideas, not just collect them.

**Discussion guide** — a named closing segment with 3–4 moderator prompts: the workaround probe ("what do you and your team already do informally to get around this?"), the invention probe, a "who else should we be asking" referral probe, and a one-thing-to-fix round-robin.

These carry `objective_ref: null` and a new `intent: "frontline_insight"` tag so they are visibly *extra-brief* rather than misfiled against an objective.

## How it is enforced

1. **Prompt** — the drafting system prompt in `instrument-draft.server.ts` gains a required section describing the block, its intent tag, and the rule that its wording must name the study's actual subject matter.
2. **Post-draft guarantee** — a deterministic check after the AI returns: if no question carries `intent: "frontline_insight"`, append a study-worded fallback block. The instrument can never ship without it.
3. **Schema** — `FieldQuestion` gains optional `intent`; `objective_ref` becomes optional for intent-tagged items; the Zod validator in `field-instrument.functions.ts` accepts the new field so hand-edits survive saving.

## How it shows in the UI

- In the Instruments stage, the block renders as its own labelled section — "Frontline insight · beyond the brief" — under the objective-coverage strip, with an `Explain` entry saying why every instrument carries it and that removing it is a deliberate act.
- Objective coverage maths ignores intent-tagged questions, so coverage percentages stay honest.
- The editor lets a researcher reword the prompts; deleting the whole block raises a soft warning rather than being silently allowed.

## Downstream so the answers actually land

- **Evidence stage / field synthesis** — the synthesis prompt gains a dedicated *"Innovation signals from the field"* output: candidate refinements raised by respondents, each with how many raised it, the confidence rating, and a verbatim. Without this the answers would be collected and then averaged into nothing.
- **Commencement briefing** — one line added to the Instruments section explaining to the client that every instrument closes with an open frontline-invention block, and that these signals are reported separately from the objective findings.

## Files

- `src/lib/personas/instrument-draft.server.ts` — prompt block, `intent` on `FieldQuestion`, post-draft guarantee + fallback wording
- `src/lib/personas/field-instrument.functions.ts` — Zod `intent` field
- `src/components/personas/field/InstrumentsStage.tsx` — separate section, coverage exclusion, delete warning
- `src/lib/explain/` — rationale entry for the block
- field synthesis server module — innovation-signals output
- `src/lib/personas/commencement-briefing.server.ts` — one client-facing line

Existing already-drafted instruments are untouched; a re-draft picks up the block.
