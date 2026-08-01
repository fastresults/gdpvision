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

registerRationales([
  {
    key: "research.recruitment.frame",
    title: "How the recruitment frame was set",
    short:
      "The personas, sample sizes and screening rules are derived from your source brief and the approved plan — not from a template.",
    basis:
      "The chamber reads the governing source brief first, then the supporting context and the approved programme plan, and finally what this country's second brain already holds. From that it names three to six personas whose testimony the decisions in the brief actually depend on, sets a survey target per persona proportionate to the population it stands for, marks which personas warrant a focus group, and states where such people are publicly listed.",
    caveat:
      "It is a research design, not a quota. Sample sizes assume a purposive, not a probability, sample — findings are read as directional weight of opinion within each persona, never as a national margin of error. Edit or re-derive the frame at any time.",
  },
  {
    key: "research.recruitment.sourcing",
    title: "How candidates are sourced",
    short:
      "Every proposed individual is a real, named person found in the open web with a citable source URL.",
    basis:
      "Each persona is researched in its own grounded pass over the live web — ministry directories, association member lists, chamber registries, board pages, published interviews and news. A candidate is only proposed when the pass can attach an https source showing who they are and why they match the persona. Contact details are used only where they are already published. No candidate is proposed without a source, and none is invented to fill a target.",
    caveat:
      "Public sourcing skews toward people who are visible — officeholders, association leaders, operators who speak to the press. Under-represented voices usually need the manual add or a partner list, and the confidence flag on each candidate tells you how firm the identification is.",
  },
  {
    key: "research.recruitment.groups",
    title: "How focus groups are balanced",
    short:
      "Groups are composed from accepted participants only, balanced so that no single interest dominates a room.",
    basis:
      "Only people you have accepted are seated. The chamber then builds slates of roughly six to ten around a shared question, mixing organisations and seniority so that one ministry, firm or faction cannot set the tone, and keeping people whose presence would silence others in separate rooms. Each slate carries the stated reason it exists.",
    caveat:
      "Composition is a proposal about dynamics, which no model can fully predict. You can move anyone between slates before invitations go out, and the group's own transcript is what the finding is ultimately drawn from.",
  },
  {
    key: "research.instrument.derivation",
    title: "How the instrument is written",
    short:
      "Drafted on arrival from the source brief, the supporting context and the approved plan — not from a stock question bank.",
    basis:
      "The chamber reads the governing source brief, the scope read-out, and the approved programme plan's objectives, method mix and audiences. It then writes one instrument per method the plan obliges: a self-completion questionnaire for the survey lines, a moderator discussion guide for the depth interview, focus group and expert panel lines. Desk-research lines carry no instrument. Every question is tagged to the objective it serves.",
    caveat:
      "It is a first draft written to the plan as approved. Wording, order, question type and options are all yours to edit, and re-drafting writes a fresh version rather than editing in place — save your changes first.",
  },
  {
    key: "research.instrument.coverage",
    title: "What objective coverage means",
    short:
      "Each objective in the approved plan, and how many questions in this instrument are tagged to it.",
    basis:
      "Every question carries an objective reference set at draft time and editable per question. The count is a straight tally of questions tagged to each objective in the instrument you are looking at.",
    caveat:
      "An objective showing no questions here may legitimately be served by the other instrument, or by a desk-research line that has no instrument at all. Read coverage across the whole method mix, not one tab.",
  },
  {
    key: "research.fieldwork.waves",
    title: "How the fielding ladder is derived",
    short:
      "One wave per piece of work the approved method mix obliges — not a free-form list of tasks.",
    basis:
      "The chamber reads the approved plan's method mix. Every quantitative line collapses into a single hosted questionnaire wave whose target is the sum of those sample sizes; every qualitative line groups into a session wave by kind — focus groups, depth interviews, expert panels, workshops. Desk-research lines field nothing and appear nowhere here. A wave is complete when the collection is closed or its target is met, or when every session in it has been held and its transcript filed.",
    caveat:
      "Targets are the plan's stated sample sizes. Returns collected outside this system still count once imported, and closing a wave early is always yours to do — the plan records the size you intended, and the finding should state the size you achieved.",
  },
  {
    key: "research.fieldwork.intake",
    title: "How work done elsewhere is filed",
    short:
      "Uploaded returns are read, matched to this study's instrument, and shown to you before anything enters the ledger.",
    basis:
      "Each file is parsed on its own terms: spreadsheets and exports are read as delimited data, photographs of paper forms are transcribed, documents are extracted, recordings are transcribed. For quantitative material the chamber matches every uploaded column to a question in the instrument of record by meaning rather than wording, coerces each answer to the type that question expects, and scores completeness per respondent. For qualitative material it produces a speaker-labelled transcript, a factual summary and — only where the material settles them — answers against the discussion guide. Nothing is written until you approve the mapping; committed returns carry the instrument version they answered and the batch they came from.",
    caveat:
      "Matching is a judgement, not a fact. Anything below 60% confidence is flagged and every column can be re-pointed or excluded by hand. Rows with no instrument answers are held back by default, and a summary is only as good as the material it was drawn from.",
  },
]);
