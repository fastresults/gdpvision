# Multimodal, mobile-first Console with dual action: Ask & Send

Bifurcate the Country Console into two clear, equally visible actions that a minister can use just as easily on a phone as on a desktop:

- **Ask** — a chat with your country's Second Brain for a quick, cited answer.
- **Send** — a task-based request to our team, with voice, drop-zone attachments, and camera capture.

Both share one composer with a single mode toggle at the top, so it always feels like one place to think out loud — the toggle decides where that thought goes.

## The unified composer (Study hero)

Replace the current black "Start a request" slab on `/console/$code` with a two-mode composer card that dominates the top of the Study:

```
┌───────────────────────────────────────────────────────────┐
│  [ ● Ask ]   [ Send ]                     usually 1–2 days│
│                                                           │
│  What do you want to know?                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Textarea — grows with content                      │  │
│  └─────────────────────────────────────────────────────┘  │
│  [ 🎤 Voice ]  [ 📎 Attach ]  [ 📷 Photo ]  →  [ Ask ]    │
└───────────────────────────────────────────────────────────┘
```

- **Segmented control** at the top with two pills: "Ask" (default) and "Send". State lives in the route so `?mode=send` and `?mode=ask` are shareable and back-button-friendly.
- Placeholder, primary button label, and hint text swap by mode. In Ask mode the hint reads "Your Second Brain answers in seconds"; in Send mode it reads "Our team returns a full brief".
- The composer itself (textarea + Voice + Attach + Photo) is shared — the same input goes into either flow.
- Attach and Photo only appear in Send mode (research chat doesn't need drop-zone artifacts).
- Voice-to-text is available in both modes — you can dictate a quick question as easily as a full brief.

## Ask mode — chat with the Second Brain

Ask mode calls the existing `askCounsel` server fn (scoped to the current country) which already does retrieval + writeback against the country corpus. From the composer:

- **First send** navigates to `/console/$code/ask` and streams the answer in a conversation view.
- The Ask page is a threaded chat: user bubble, then an assistant answer split into a plain-language "spoken" summary at the top and a cited "written" block below. Citation chips are tappable and open the source in a bottom sheet.
- A "Follow up" composer stays fixed at the bottom (with the same voice mic). Threads live client-side per country in localStorage — no schema changes; the underlying `counsel_answers` table already logs each Q&A server-side.
- A "This needs more than an answer" link at the bottom of each response converts the current question into a Send-mode draft prefilled in the wizard.
- Empty state on `/console/$code/ask` shows 4 recent questions asked in this country plus 4 canned prompts drawn from the ministries on file ("What's driving inflation this quarter?", "How is tourism tracking vs target?", etc.).

## Send mode — the request wizard, now multimodal

Ties into the wizard already in the plan. Step 1 becomes the shared composer above; steps 2–4 (Which ministry / What form / When) remain as-is but get the mobile pass below.

- **Voice dictation** — press-to-record with live level meter, transcript appended to the textarea. Uses existing `useVoiceRecorder` + `transcribeAudio` (Lovable AI Gateway `openai/gpt-4o-mini-transcribe`).
- **Attach documents** — drop zone on desktop; large "Attach" and "Photo" tap targets on mobile with `capture="environment"` for the camera. Uses existing `signUploadUrl` + `parseUpload` against the `study-artifacts` bucket. Accepts PDF, DOC/DOCX, TXT/MD, images (JPG/PNG/HEIC), audio memos (m4a/mp3/wav). Cap: 20 MB, 5 files per request.
- **Attachment chips** show per-file status (Uploading → Reading → Ready → Failed) with remove. Parsed excerpts get folded into `raw_text` so intent is grounded when the agency picks it up; storage paths flow through `submitRequest.attachments`.
- Send in Step 4 waits for all attachments to be Ready (or removed).

## Mobile-first pass across both surfaces

- One-column layout throughout. Stepper collapses to `1 / 4 · What you need` with a thin progress bar on small screens.
- Sticky bottom action bar (Back / Continue or Send), safe-area-aware.
- 44 px minimum tap targets on all buttons, cards, chips; larger `card-choice` padding on mobile.
- Ministry & Outcome grids: 1 col mobile, 2 tablet, 2–3 desktop.
- Textarea: `field-sizing: content` + `min-h-[9rem]` mobile — grows with content, doesn't dominate viewport.
- Voice / Attach / Photo render as a 3-wide row on mobile; drop zone (drag-and-drop) only shows from `md` up (drop zones make no sense on touch).
- Headings drop from `text-4xl/5xl` to `text-3xl` on mobile.
- Console shell (`console.tsx`) gets a hamburger drawer on mobile with Study / Requests / Ask / Sign out. "Start" pill stays visible as an icon-only control.
- Ask chat: input pinned to bottom with `env(safe-area-inset-bottom)`; message list uses `overscroll-contain` and virtualizes only if a thread exceeds 40 turns.

## Files to change / add

New:
- `src/components/console/RequestComposer.tsx` — the two-mode composer card (Ask/Send segmented control, textarea, voice, attach, photo, submit).
- `src/components/console/AttachmentChip.tsx` — per-file status pill.
- `src/components/console/CitationChip.tsx` + `CitationSheet.tsx` — tappable citation and mobile bottom sheet.
- `src/hooks/useConsoleUploads.ts` — signed URL → PUT to storage → `parseUpload`, tracks status per file.
- `src/hooks/useCountryAskThread.ts` — localStorage-backed per-country ask thread (id, messages, updatedAt).
- `src/routes/_authenticated/console.$code.ask.tsx` — the Ask conversation page.

Modified:
- `src/routes/_authenticated/console.$code.index.tsx` — replace the black CTA with `<RequestComposer />` at the top; mobile layout pass on masthead, attention band, lanes, ministries.
- `src/routes/_authenticated/console.$code.request.new.tsx` — Step 1 uses `<RequestComposer mode="send" />`; wizard shell restructured for mobile (compact stepper, sticky footer); on submit, include `attachments` + parsed excerpts in `raw_text`.
- `src/routes/_authenticated/console.tsx` — mobile nav (hamburger drawer + safe-area header), Ask/Study/Requests links.
- `src/routes/_authenticated/console.$code.requests.index.tsx` — mobile-friendly two-line rows, wrapping filter chips.

No schema changes, no new secrets, no new tables. Reuses:
- `askCounsel` (`src/lib/counsel.functions.ts`) — country corpus RAG with citations and rate limits.
- `transcribeAudio` (`src/lib/personas/transcribe.functions.ts`) — mic → text.
- `signUploadUrl` / `parseUpload` (`src/lib/personas/parse-upload.functions.ts`) — direct-to-storage upload + AI-based text extraction (text/PDF/DOCX/image OCR/audio transcript).
- `submitRequest` (`src/lib/concierge/concierge.functions.ts`) — already accepts `attachments`.

## Behaviour details

- Mode toggle preserves what's in the textarea when you switch — the same thought can flip from a question to a task without retyping.
- Voice dictation: tap → red pulsing "Stop · 0:12" with live meter → transcript appends to the textarea on stop; "Transcribed" toast on success. Mic denied → chip becomes "Mic blocked — tap for help"; typing/attaching still work.
- Uploads run in parallel. Attachments that parse to > 400 chars get collapsed under "Show extracted text".
- Ask mode enforces server-side rate limit already coded in `askCounsel` (per-user per-hour, per-scope per-day); errors surface as an inline toast.
- All existing minister-lexicon scrubbing on `raw_text` / `minister_summary` continues to run in `submitRequest`; assistant answers in Ask mode remain in the country's own language and never surface chamber vocabulary.

## Out of scope

- Streaming/live transcript during recording (kept simple; can be added later on the SSE branch of the STT endpoint).
- Multi-speaker meeting capture (ElevenLabs territory) — not needed here.
- Server-side thread persistence for Ask — localStorage per country is enough for v1; the `counsel_answers` table already keeps a per-user audit log.
