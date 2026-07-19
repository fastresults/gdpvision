## Goal
Make every visible citation marker on the persona/detail experience render as a superscript, clickable source reference with a clear source modal/popover — not raw `[1, 41]` text.

## What I verified
- The persona detail screen currently renders `persona.summary` as plain text, so markers like `[1, 41]` appear raw.
- The persona chat uses raw `ReactMarkdown`, so assistant replies can also show raw citation markers.
- The attributes grid renders values directly and even uses raw `JSON.stringify` for objects, bypassing the existing global `PrettyJson` citation-aware renderer.
- The existing `CitedText`, `CitedMarkdown`, `CitationSup`, and `PrettyJson` utilities already support superscript citations and source hover/modal behavior, but Chamber 07 is not consistently using them.
- Persona server functions currently return citation packs only at generation/ask time; persisted persona rows do not include a durable citation list for the detail page to resolve source metadata after reload.

## Plan
1. **Persist citation metadata for personas**
   - Add a safe citation metadata field for generated personas if one does not already exist in the backend schema.
   - Store the country context citation pack alongside each generated persona and segment persona.
   - Keep `grounding_refs` as the compact numeric grounding reference list, but use the stored citation pack for UI resolution.

2. **Hydrate citation metadata on persona detail load**
   - Update `getPersona` to return the persona plus its citation list in a UI-safe shape.
   - Ensure old personas without stored citation metadata still render superscript markers using fallback references where possible, instead of raw bracket text.

3. **Replace raw text rendering in the persona detail route**
   - Render `persona.summary` with `CitedText`.
   - Render assistant chat messages with `CitedMarkdown`, passing each message’s persisted `citations` array.
   - Keep user messages plain/uncited.

4. **Fix attributes rendering and the JSON global rule violation**
   - Replace the manual attributes grid value rendering with citation-aware, human-readable rendering.
   - For JSON-shaped attribute values, use `PrettyJson` with citations instead of `JSON.stringify` in JSX.
   - For arrays/strings containing `[N]`, render via `CitedText` so citations remain superscript and interactive.

5. **Harden citation click behavior**
   - Make citation triggers behave consistently as superscript controls across `CitedText`, `CitedMarkdown`, and persona attributes.
   - Preserve the existing hover source card and modal-style source inspection pattern; no raw markers should remain in the visible UI.

6. **Audit nearby Chamber 07 study screens**
   - Replace raw `ReactMarkdown` in persona study report rendering with `CitedMarkdown` and the report’s citation metadata.
   - Check study responses/transcripts for displayed citation arrays or markers and route them through the same citation-aware components.

7. **Validate visually and structurally**
   - Reopen the persona detail route and verify the screenshot case now shows superscript citation markers.
   - Click/hover at least one citation and confirm the source card/modal shows the source label/title/url.
   - Verify there are no remaining raw `[N]` markers in visible persona summary/chat/report text, except inside collapsed debug/raw JSON views.