# Government-grade assumption assurance for the Decision Brief

## Objective
Make the public calculator unmistakably transparent about what is known, what is assumed, and what must be validated before government decisions are taken—without weakening the authority or clarity of the brief.

## Proposed experience

### 1. Add an “Evidence status” assurance strip
Place a compact, persistent strip above the calculator and repeat its status beside the verdict:

- **Public indicative model** — clearly identifies the current experience as an open decision-framing instrument, not an approved forecast or business case.
- Show a live count of **record-backed**, **reference-based**, and **user-adjusted** inputs.
- Use the existing Grade A/B/C language for evidence quality, with a distinct **Assumption** state and no false precision.
- Provide one clear action: **How this becomes decision-grade**.

Suggested lead copy:

> **An open decision-framing instrument.** This public brief combines graded national records with clearly marked reference assumptions where evidence is incomplete. During a government engagement, those assumptions are replaced with authorised administrative data, validated by accountable officers, and locked to a dated evidence baseline before recommendations are relied upon.

### 2. Make provenance visible at every editable input
Upgrade each input’s supporting line so its current state is immediately legible:

- **From the national record · Grade A/B/C**
- **Reference assumption · regional benchmark**
- **Adjusted by you · not independently validated**

Each state will open the existing explanation modal on click or keyboard activation. The modal will state:

- what the value represents;
- where the current value came from;
- why a reference assumption was used;
- what official evidence would replace it;
- how changing it affects the result.

Hover remains a convenient preview on desktop, but disclosure will not depend on hover so it also works on mobile, touch, keyboard and print.

### 3. Add a government engagement pathway modal
The assurance-strip action opens a focused modal titled **From public estimate to decision-grade brief** with four stages:

1. **Establish the baseline** — reconcile current national statistics and approved records.
2. **Replace assumptions** — ingest administrative datasets for the fields identified by the calculator.
3. **Validate and assign accountability** — record source, period, custodian and authorised reviewer for each input.
4. **Issue the controlled brief** — lock the evidence date, model version, approvals and audit trail.

The modal will also list the specific unresolved inputs for the selected country, so the pathway is actionable rather than generic. It will avoid implying that a user’s slider adjustment becomes an official fact.

### 4. Carry the assurance into the downloadable brief
Add a concise **Evidence status and validation requirement** block to the printable Decision Brief:

- counts by evidence state;
- explicit identification of reference assumptions and user adjustments;
- the date the public record was read;
- wording that the brief becomes decision-grade only after government validation and approval.

The existing source table, model version, derivations and “not a forecast” qualification remain intact.

## Technical details

- Derive evidence-state counts client-side from the existing fact grades, proposed values and current slider values; no new database table or submission flow is required.
- Add a small reusable assurance component for the screen and print variants.
- Extend the current rationale modal context to show source status and replacement evidence for each framing input.
- Preserve deterministic arithmetic: this work changes disclosure and provenance presentation only, not coefficients, calculations, AI counsel or stored country data.
- Use the existing semantic colour tokens, button utilities, dialog component and Explain registry.

## Verification

- Check a well-populated country and a sparse country to confirm all three evidence states are accurate.
- Change an assumed and a record-backed input and confirm each becomes **Adjusted by you**, without being represented as verified.
- Verify mouse, keyboard, touch-sized layout and printed/PDF output.
- Confirm the verdict and all calculations remain unchanged for identical inputs.
