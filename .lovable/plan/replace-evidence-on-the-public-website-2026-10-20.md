# Replace "evidence" on the public website

## Goal
On every page a visitor can see without signing in, replace the word "evidence" with "trusted data" or "data", whichever reads naturally.

## Pages covered
Homepage, /present (presentation, decision journeys, Data & Decision Flow map and scenarios), Vault, /record, Business case, Calculator, public brief, op-eds index, and the homepage page title/description.

## Rule for choosing the word
- "trusted data" where the word carries the weight of reliability or proof (e.g. "built on evidence" -> "built on trusted data", "evidence you can defend" -> "trusted data you can defend").
- "data" where it is just the material being gathered or shown (e.g. "evidence gathered" -> "data gathered", "national evidence" -> "national data").
- Fix grammar around it (articles, plurals, "evidence-based" -> "data-based"/"built on trusted data"), and avoid saying "trusted data" twice in one sentence.
- Keep headings short; adjust a line if the swap makes it awkward.

## Not changed
- Admin and Chamber screens, AI instructions, database names, internal code names and file names.
- Hidden keys the decision journeys use to look up their steps, so playback keeps working.

## Technical details
- Edit visible strings only in `src/routes/{index,vault,record,business-case,op-eds.index}.tsx`, `src/components/marketing/**`, `src/components/calculator/**`, `src/components/brief/**`, `src/lib/business-case.ts`.
- Leave identifiers, component names (e.g. `EvidenceAssembly`), ids, `<Explain id>` keys and scenario title keys untouched.
- Afterwards run `rg -i evidence` over those files and confirm only code identifiers remain; screenshot homepage and /present.
