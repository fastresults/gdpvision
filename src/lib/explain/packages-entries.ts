// @domain explain
// @tables none
// @ui src/components/investments/packages/InvestorPackagesPanel.tsx
//
// Rationale entries for investor packages: how generated figures are checked,
// what "stale" means, and what approval requires.

import { registerRationales, type Rationale } from "@/lib/explain/registry";

const entries: Array<Rationale<never>> = [
  {
    key: "packages.number_guard",
    title: "How numbers in a package are checked",
    short:
      "Every figure the model wrote is matched against the facts the package was built from; anything unmatched is bracketed.",
    formula:
      'After drafting, every number in the text is extracted — amounts, percentages, years and counts — and its scale normalised (40,000,000 = 40m = US$40 million). It passes if a fact holds the same value within the rounding the text implies: "3.5%" accepts 3.46; "US$40 million" accepts 39.5m to 40.5m. A year passes if it appears in a fact or a fact\'s period. Anything else is replaced in the text by "[unverified: …]" and counted as a warning.',
    basis:
      "The facts are the project's public fields, the country's published headline indicators with period and source, and the readiness checks. They are stored with each version, so a reviewer can see exactly what the draft was written from.",
    caveat:
      'Whole numbers from 0 to 10 without a unit, ordinals and standard references ("FATF R.24", "IFC PS1") are not checked. Numbers written as words are not detected. A matched number can still be used in the wrong sentence: the check proves the figure exists, not that the claim around it is right. Read the draft before approving.',
  },
  {
    key: "packages.stale",
    title: "Why a package is marked out of date",
    short:
      "The project record has changed since this package was generated, so it may no longer match the project.",
    formula:
      "Each package records the project version it was built from. Any edit to the project raises its version. When the two differ, the package is out of date.",
    basis:
      "Enforced in the database: an out-of-date package cannot be approved (investment_packages_guard, migration 0009).",
    caveat:
      "Generate a new version to bring it up to date. Earlier versions stay in the history and are not changed.",
  },
  {
    key: "packages.approval",
    title: "What approving a package requires",
    short:
      "A second person with an investment-approver role, an approved project, and a package built from the current project version.",
    formula:
      "Drafts can be prepared at any stage. Approval needs all of: the approver did not draft this version; the approver holds an investment-approver role for this country; the project itself is approved; the package was built from the project's current version. Approving a version supersedes the previously approved version of the same kind.",
    basis:
      "The rules are enforced by the database trigger investment_packages_guard, so they hold however the request arrives. Approved packages cannot be edited.",
    caveat:
      "Approval confirms the package is fit to share with investors. It is not an investment recommendation.",
  },
];

registerRationales(entries);
