// @domain explain
// @tables none
// @ui src/components/personas/TrackGateEntry.tsx
//
// Rationale entries for Chamber 07 (The Research Chamber). These explain what
// each instrument's standard of proof actually means, so a principal can see
// what weight a return can carry before choosing the track.

import { registerRationales, type Rationale } from "@/lib/explain/registry";

const entries: Array<Rationale<never>> = [
  {
    key: "research.proof.synthetic",
    title: "Directional, not defensible",
    short:
      "A synthetic public tells you where an argument is weak. It is not evidence you can publish.",
    basis:
      "Personas are cast by the model from this country's second brain — corpus documents, ledger figures, ministry and sector dossiers. Their responses reflect what that corpus says about the population, not what the population said.",
    caveat:
      "Use it to rehearse, to pressure-test framing, and to decide what is worth asking the real public. Never cite a synthetic result as public opinion in a Cabinet paper or a press line.",
  },
  {
    key: "research.proof.field",
    title: "Citable evidence",
    short:
      "Real participants, dated instruments and filed transcripts — a return a Cabinet can publish.",
    basis:
      "A field programme records who was asked, when, with which instrument, and what they said. Every session, transcript and artefact is filed to the second brain with provenance, so any figure can be traced back to its source.",
    caveat:
      "It takes weeks, not minutes, and its strength depends on the sample and the instrument. The programme plan states both so the limits travel with the finding.",
  },
];

registerRationales(entries);

registerRationales([
  {
    key: "research.intake.readout",
    title: "How the chamber reads your material",
    short:
      "Every document, recording and link you supply is extracted to text and read in one pass into a proposed programme.",
    basis:
      "Files are parsed server-side (documents and slides by document extraction, images by OCR, audio by transcription); links are scraped for their main content. The combined text — never a summary of it — is what the model scopes into objectives, hypotheses, decisions, stakeholders, timeframe and sensitivities.",
    caveat:
      "The proposal is a first draft of your brief, not a finding. Anything the material is silent on is listed as an open question rather than invented, and every field stays editable before you open the chamber.",
  },
  {
    key: "research.intake.recommendation",
    title: "Why this instrument was recommended",
    short:
      "The recommendation follows the standard of proof your material implies — and you can override it.",
    basis:
      "Material that asks for a same-day read, a framing test or a rehearsal points to the Synthetic Lab. Material that asks for evidence a Cabinet can publish — named participants, dated instruments, citable numbers — points to a Field Programme. Where both are needed, the blended track rehearses first and verifies after.",
    caveat:
      "It is a reading of your documents, not a ruling. Choosing the other instrument changes nothing about the brief; you can also add the second track to the same programme later.",
  },
  {
    key: "research.intake.brief-precedence",
    title: "Source brief vs. supporting context",
    short: "One document governs the programme. Everything else colours it but cannot overrule it.",
    basis:
      "The source brief — the RFP, cabinet memo, tender notice or the principal's own dictated words — decides the objectives, decisions, timeframe and geography. Supporting context is read afterwards and may only enrich, illustrate or qualify those. Both are filed to this country's second brain with their role attached (brief or context), so later retrieval weighs the brief above its context.",
    caveat:
      "Where a supporting document contradicts the brief, the brief is kept and the contradiction is surfaced as an open question rather than silently resolved. You can promote or demote any item at any time.",
  },
]);

registerRationales([
  {
    key: "research.stage.done",
    title: "What finishes this stage",
    short:
      "Each field stage has one objective test — an artefact that exists in the record, not an opinion.",
    basis:
      "The rail reads the programme's real artefacts on every visit: the committed brief, the active plan, panel membership, saved instruments, collected returns and held sessions, and the synthesised finding. A stage shows as done only when its artefact is present, so the stepper can never claim progress the record does not support.",
    caveat:
      "You may move ahead of an incomplete stage — research is rarely linear — but the outstanding item stays visible, and anything downstream that depends on it will say so rather than fail quietly.",
  },
]);
