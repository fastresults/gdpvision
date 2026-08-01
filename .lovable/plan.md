## Goal

Stage 02 (Participants) currently starts empty and demands a pasted roster. It should open the way the rest of Chamber 07 does: the AI reads the brief, plan and second brain, researches the country's real landscape, and **proposes named individuals** — split into a survey frame and focus-group slates — which the admin accepts, edits, adds to, or deletes.

## The beat

```text
Recruitment brief (AI-derived personas)  →  Deep research pass  →  Candidate slate
        ↓                                                              ↓
  admin can edit segments                              accept one / accept all / edit / delete
                                                               ↓
                                                    contact book + panel(s)  →  Stage 03
```

## 1. Recruitment brief (auto, no blank form)

On entering Participants with no contacts, the stage derives a **recruitment brief** from the source brief, approved programme plan and country corpus:
- 3–6 **target personas** (who they are, why they matter to the decision, seniority, sector, region)
- per persona: target **survey count** and whether they belong in a **focus group** slate
- screening criteria and exclusions

Shown as an editable read-out (same document style as the plan stage), not JSON. Admin can adjust counts/personas before research runs.

## 2. Deep research pass (the AI-first core)

A server-side loop, one fan-out per persona, through the existing research waterfall (Perplexity `sonar-reasoning-pro` → Gemini fallback), reusing the pattern in `party-research.server.ts` / `minister-research.server.ts`:

- For each persona: find **real, named, publicly identifiable individuals** in that country matching the persona — ministry officials, association heads, chamber-of-commerce members, operators, academics, diaspora leads.
- Each candidate must return: name, role/title, organisation, why-they-fit (one line tied to the persona), public contact route (official email / org page / LinkedIn), and **at least one https source URL**. No source ⇒ candidate is dropped.
- A validation/dedupe pass: reject duplicates against existing `research_contacts` (normalised name+org / email), reject obvious hallucinations (no source, dead-generic names), and score each candidate `high | medium | low` confidence.
- Coverage check: if a persona comes back under target, a **second redrive pass** runs with widened phrasing before the stage reports "thin coverage" honestly rather than padding.
- Focus-group slates are composed after the survey frame: the AI groups accepted-eligible candidates into 1–3 balanced groups (6–8 each) with a stated composition rationale.

Everything is filed to the second brain as a `recruitment_frame` memory object with its citations, deduped on the programme key. Identity itself stays in `research_contacts` only — corpus keeps the frame and rationale, not personal records.

## 3. Admin control surface

A candidate table grouped by persona, each row: name · role · organisation · fit line · confidence chip · source link.

- **Accept** (per row) → creates/links a `research_contacts` row.
- **Accept all** per persona, and **Accept all** globally.
- **Edit** inline (name, role, org, email, persona, notes) before or after acceptance.
- **Delete / reject** a candidate, with the reason retained so a re-run doesn't re-propose it.
- **Add manually** — one-off add plus the existing paste-roster importer, kept as a secondary path.
- Two panel targets: **Survey frame** and **Focus group** slates; a person can sit in both.
- "Research more like this" per persona to top up a thin slate.

Every AI-derived number (target counts, group sizes, confidence) is wrapped in `<Explain>` with rationales registered in the personas entries file.

## 4. Stage completion

"Done when" for Participants becomes: survey frame has ≥ the brief's minimum accepted contacts **and** at least one focus-group slate is formed (or explicitly waived with a recorded reason). `field-progress.server.ts` reports the single outstanding blocker as it does today.

## Technical notes

- Migration: add `research_contacts` candidate fields — `status` (`proposed|accepted|rejected`), `persona_label`, `fit_reason`, `confidence`, `source_url`, `proposed_by_run`; plus a `research_panels.kind` (`survey|focus_group`). GRANTs + RLS scoped by `has_country_access` in the same migration, matching existing policies on those tables.
- New `src/lib/personas/recruitment-research.server.ts` (deep research + validation + dedupe) and `recruitment.functions.ts` (`deriveRecruitmentBrief`, `researchCandidates`, `acceptCandidates`, `rejectCandidate`, `composeFocusGroups`) — all `.middleware([requireSupabaseAuth])`, called from components via `useServerFn`.
- Research runs persona-by-persona so a single slow fan-out can't 502 the stage; the UI streams slates in as each persona resolves.
- `ParticipantsStage.tsx` restructured into: recruitment brief → candidate slates → panels, with paste-import demoted to a secondary action. Existing CRM functions reused, not replaced.
- Run `bun run headers && bun run map` after adding the new server-fn modules.
