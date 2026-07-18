## Problem

In `ArtifactPanel` (Press Release, Policy Memo, etc.), the LLM returns Markdown (`**bold**`, `### heading`, `-` lists). It is being displayed as raw source instead of being rendered — so users see `**GOVERNMENT OF ANTIGUA AND BARBUDA**` and `### ANTIGUA…` literally, with the asterisks and hashes visible.

## Fix

Swap the raw text renderer inside `src/components/ledger/ArtifactPanel.tsx` for a proper Markdown renderer, using the same library already in the project (`react-markdown` + `remark-gfm`, already used elsewhere in the ledger UI).

Steps:

1. In `ArtifactPanel.tsx`, replace the current `<div className="whitespace-pre-wrap">{body_md}</div>` (or equivalent) with a `<ReactMarkdown remarkPlugins={[remarkGfm]}>` block wrapped in a `prose` container tuned to the app tokens:
   - `prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-ink-950 prose-p:text-ink-800 prose-strong:text-ink-950 prose-li:text-ink-800 prose-a:text-indigo-700 prose-hr:border-line-200`
   - Preserve the editorial serif/mono accents already used in the ledger (headings use the same font stack as the rest of the chamber).

2. Keep `[N]` citation markers clickable. The Markdown text still contains `[1]`, `[2, 5]` etc. — post-process each rendered text node (custom `components={{ p, li, strong, em }}` renderers) to run the existing `renderCitations(text, citations)` helper on string children so `<CitationRef>` popovers keep working inside the rendered Markdown, exactly like they do in the main answer block.

3. Do the same treatment inside the "Refined" re-render path so a refined artifact also renders as formatted Markdown.

4. No changes to server prompts, artifact kinds, or citations shape. Purely a rendering fix in one component.

## Files

- `src/components/ledger/ArtifactPanel.tsx` — swap raw text for `ReactMarkdown`, wire `renderCitations` through custom component renderers, apply `prose` classes.

## Acceptance

- Press Release, Policy Memo, Executive Brief, Talking Points, and Op-Ed all render with real headings, bold, italics, lists, and horizontal rules — no visible `**`, `###`, or `-` source characters.
- `[N]` citation chips inside the rendered artifact remain clickable and open the same citation popover as the main answer.
- Copy / Download .md still emit the original Markdown source (unchanged).
