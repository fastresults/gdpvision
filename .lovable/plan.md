# Fix report provenance: no defaults, no guessing, no leakage

## Verified failures

- The project’s governing brief is `OPEN_Interactive_IMA_Grenada_RFP_Response_v6.pdf`. It explicitly says **Prepared for: Investment Migration Agency Grenada** and **Submitted by: Stachio Williams / OPEN Interactive**.
- The displayed **“The Office of the Prime Minister”** is not from that brief. It is a hardcoded print default in `PrintableBriefing.tsx`, and export settings are persisted under one global browser key, so values can bleed between projects.
- This project has **zero characters in `brief_raw`** and 8,000 characters in `brief_source.excerpt`. The briefing assembler reads `brief_raw` but does **not** read the governing `brief_source` excerpt. Therefore, the actual source document is omitted from the report-generation input.
- The report is not currently bounded to the original brief. It also consumes the active programme plan, recruited contacts, generated instruments, waves, milestones, deliverables and risks. Some of those are AI-derived downstream artefacts rather than verbatim governing-brief facts.
- The latest regenerated briefing (v5) still contains **“second brain”**. The latest regenerated deck (v2) still contains **“GDPVision,” “Chamber,” and “second brain.”** Prompt instructions alone did not stop leakage, and there is no deterministic validation gate rejecting contaminated output.
- The current participant section exposes researched role/organisation details and model-authored rationales. Those are not part of the original brief and therefore violate the requested source boundary.
- Existing saved briefing/deck versions remain immutable snapshots; changing code does not clean them automatically. The UI continues opening the latest stored contaminated snapshot until a clean replacement is generated.

## Implementation plan

### 1. Establish one immutable governing-source snapshot

- At brief commit, persist a normalized, immutable source snapshot containing:
  - governing document identity and extracted text;
  - exact client/addressee;
  - exact submitting organisation/preparer;
  - programme title, objectives, constraints, dates, deliverables and other explicitly supported facts;
  - provenance pointers back to the source excerpt/page or field.
- Treat supporting context separately and label it explicitly; it may qualify the governing brief but may not silently create new client promises.
- Make all report/deck generation read this committed snapshot—not `brief_raw` alone and not mutable browser state.

### 2. Replace open-ended generation with a provenance allow-list

- Build a typed “client output context” from only:
  1. the committed governing-source snapshot;
  2. explicitly approved project artefacts that are necessary to describe execution, each carrying its source type and approval state.
- Exclude unapproved AI proposals, researched personal details, corpus/platform terminology and generic internal workflow copy.
- For every report field and section, declare its allowed source:
  - cover identity → governing brief only;
  - client ask/objectives/constraints → governing brief only;
  - programme dates/deliverables → approved plan, but only where traceable to or explicitly approved against the brief;
  - participants → approved persona/segment labels only, never researched names, organisations or model-authored biographies;
  - instruments/fieldwork → approved artefact facts only;
  - evidence language → neutral client-facing copy, with no internal platform vocabulary.

### 3. Remove all guessed cover metadata

- Delete the hardcoded Prime Minister default.
- Derive **Prepared for** and **Prepared by** from the governing brief snapshot for each project.
- Make the browser export key project-specific, or remove browser persistence for source-owned fields entirely.
- Do not permit stale cross-project values to override source-owned metadata. Any optional manual override must be explicit, project-scoped and visibly marked as an override.

### 4. Add deterministic contamination and unsupported-claim gates

- After AI composition, validate every generated section and slide before saving.
- Reject output containing banned internal terms such as GDPVision, Chamber names/numbers, second brain, internal workspaces or platform terminology.
- Require every factual statement, number, date, client name, deliverable and constraint to resolve to an allowed provenance record.
- If validation fails, retry once with the violations identified; if it still fails, use a deterministic source-grounded rendering rather than saving guessed copy.
- Never save or display a report/deck that fails the gate.

### 5. Make provenance visible before export

- Add a preflight panel showing, section by section:
  - source: governing brief / approved plan / approved participant segment / approved instrument;
  - unsupported claim count;
  - banned-term count;
  - status: ready or blocked.
- Block PDF, presentation and PowerPoint export until the preflight passes.
- Add a clear “Rebuild from governing brief” action that creates a new clean briefing and then a deck tied to that exact briefing version.

### 6. Repair this project’s stored outputs

- Regenerate the Grenada briefing from the actual uploaded governing brief and approved, traceable artefacts.
- Generate a new deck only from that clean briefing version.
- Mark contaminated briefing/deck versions as superseded so the UI cannot open or export them by default; preserve them only for audit history.
- Verify the cover reads from the brief: **Investment Migration Agency Grenada** and the correct submitting organisation, with no Prime Minister default.

### 7. Test the contract permanently

- Add regression tests proving:
  - uploaded governing-brief text is used when `brief_raw` is empty;
  - no global/localStorage metadata crosses projects;
  - banned platform terms cause generation failure;
  - names, numbers and dates absent from allowed sources cannot be saved;
  - participant identities and researched organisations never enter client-facing outputs;
  - a deck is always linked to—and generated from—the validated briefing version shown in the UI.
- Validate the regenerated Grenada briefing, PDF, presentation view and editable PowerPoint against the same provenance report.