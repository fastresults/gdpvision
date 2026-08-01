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
