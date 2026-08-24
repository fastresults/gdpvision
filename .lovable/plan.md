# Chamber 07 · Brief intake — add-more + document viewer

## What's actually wrong (confirmed by reading the code)

The screen in the screenshot is `BriefStage` → `ProgramBriefIntake`. Two real gaps sit underneath the two things you asked for:

1. **"Add to intake" half-exists but leaks.** Post-commit, the intake editor is on the page and autosaves — but material added there is saved **only to the project row**. It is never filed into the second brain. `fileProgrammeMaterial` (the corpus filing fn) is called from exactly one place: `ProgrammeSetup` during first-time setup. `commitProjectBrief` doesn't file, and neither does any post-commit save. So anything added after the first pass silently misses the corpus — downstream stages, retrieval, and citations never see it. There is also no way to *remove* an uploaded item, and the "What we have gathered" summary is read-only with no add affordance.

2. **No way to view a gathered document.** Items render as name-only chips. The stored `excerpt` is truncated at 8,000 characters; the full text lives only in the storage file (and in the corpus document, for the minority of items that got filed). There is no view/download affordance anywhere in the stage.

## The fix

### A. Make filing follow the material (the real bug)

- `src/lib/personas/project-brief.functions.ts`
  - `commitProjectBrief` — after marking committed, call `fileProgrammeMaterial`'s underlying logic for the source brief + all context uploads (idempotent by design: dedupes on source URL + content hash, so re-runs write nothing).
  - `saveProjectBrief` — when the brief is **already committed**, file any newly added/changed items the same way, so amendments land in the second brain immediately. Pre-commit saves skip filing (material is still in flux).
  - Implementation detail: extract the filing loop from `corpus-file.functions.ts` into a shared server helper (e.g. `fileIntakeItems` in a `.server.ts` module) that both `fileProgrammeMaterial` and the brief fns call — no duplicated logic, same dedup keys, same `role:brief` / `role:context` / `project:<id>` tags.

### B. Document viewer modal

- New server fn in `src/lib/personas/corpus-file.functions.ts`:
  - `getIntakeDocument({ countryCode, projectId, path })` — looks up the corpus source for the item (tagged `project:<id>`, URL = `study-artifacts://<path>` or the pasted link), and returns:
    - `text` — full `raw_text` from the latest `country_source_documents` row (not the 8k-truncated excerpt),
    - `downloadUrl` — a signed URL for storage files, or the external URL for link items,
    - `filed: boolean` — false when the item hasn't reached the corpus yet.
- New component `src/components/personas/StudyWizard/IntakeDocumentModal.tsx` (built on the existing `Sheet` primitive, matching `SourceDetailSheet`):
  - Header: document name, role badge (Source brief / Supporting context), size, "Open original" button (signed URL / external link).
  - Body: full extracted text, scrollable, mono-prose styling.
  - Fallback: if not yet filed, show the stored excerpt with a clear note "Preview — first 8,000 characters; filed to the second brain on save."
- Wire **View** buttons onto:
  - the source-brief row in the intake rail,
  - every supporting-context upload row,
  - the two gathered tiles (source brief tile → its document; context tile → first item / list).

### C. Add / remove affordances on the gathered summary

- "What we have gathered" section gains an **Add material** button (`btn-secondary`) that smooth-scrolls to and focuses the intake rail's upload control.
- Each context upload row gains a **remove** (✕) button alongside "Make source brief" (removal updates local state; autosave persists; already-filed corpus copies are left untouched — the second brain is append-only by contract, noted in the modal).

## Files touched

| File | Change |
| --- | --- |
| `src/lib/personas/project-brief.functions.ts` | File material on commit + on post-commit save |
| `src/lib/personas/corpus-file.functions.ts` | Extract shared filing helper; add `getIntakeDocument` |
| `src/lib/personas/corpus-file.server.ts` (new) | Shared `fileIntakeItems` server helper |
| `src/components/personas/StudyWizard/IntakeDocumentModal.tsx` (new) | Viewer modal |
| `src/components/personas/StudyWizard/ProgramBriefIntake.tsx` | View/Remove/Add-material wiring |

## Verification

1. On the committed GRD brief: add a new context PDF → confirm it saves, appears in `country_sources` tagged `project:<id>` with chunks embedded (read query).
2. Click View on the source brief → modal shows full text (longer than the 8,000-char excerpt) and "Open original" downloads the PDF.
3. Remove an item → disappears from the list and persists across reload.
4. `bun run check:maps` passes (new server-fn header tags in place).
