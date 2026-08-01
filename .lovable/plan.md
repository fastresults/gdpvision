## What's actually wrong (read from the code, not guessed)

The entrance at `/admin/countries/$code/personas` renders `TrackGateEntry` and it fails as a decision surface:

1. **The choice isn't binary.** Three equal-weight cards render side by side (`synthetic`, `field`, `blended`). A third "Rehearse, then verify" column turns a clear fork into a menu.
2. **The gate is buried.** The page stacks a small header, then the gate card, then the entire `ProgramsIndex` list below it. Nothing commands the screen.
3. **The commitment step comes first and looks like a form.** A bare text input plus two raw `<input type="radio">` Public/Private controls sit in the card header, before the user knows what they're choosing between. Both CTAs are disabled until it's filled, and the only explanation is a `title` tooltip.
4. **The cards are dense and undifferentiated** — same icon treatment, same dl/bullet stack, same button. Nothing conveys "minutes, directional" vs "weeks, citable" at a glance.

## The rebuild

**Stage 00 becomes a full-bleed decision screen, not a card on a list page.**

```text
┌──────────────────────────────────────────────────────────────┐
│  CHAMBER 07 · THE RESEARCH CHAMBER                           │
│  How should this question be asked?                          │
│  One decision. You can add the other instrument later.       │
├───────────────────────────┬──────────────────────────────────┤
│  SYNTHETIC LAB            │  FIELD PROGRAMME                 │
│  [engraved illustration]  │  [engraved illustration]         │
│  Ask a synthetic public   │  Ask the real public             │
│  — today.                 │  — properly.                     │
│                           │                                  │
│  MINUTES                  │  WEEKS                           │
│  Directional              │  Citable evidence                │
│  · Cast personas          │  · Programme plan, phases        │
│  · Group segments         │  · Participants & comms          │
│  · Rehearse studies       │  · Instruments & fieldwork       │
│                           │                                  │
│  [ Choose Synthetic Lab ] │  [ Choose Field Programme ]      │
└───────────────────────────┴──────────────────────────────────┘
        Not sure? Run both — rehearse, then verify. (quiet link)
              ─────────────────────────────────────
        Or resume a programme:  [3 recent programmes] · All programmes →
```

Concretely:

- **Two panels only.** Half-screen each, min-height ~440px, hairline divider, hover raises the panel and reveals the CTA in full ink. `blended` demotes to a single quiet line under the fork ("Run both — rehearse, then verify"), which starts a blended programme.
- **Choose first, name second.** Clicking a panel opens a focused confirm step (inline slide-over on the same screen): programme name, Public/Private as two labelled toggle chips (not raw radios), and a one-line restatement of the track chosen with a "change" link. Create button is the only action. No disabled buttons on the fork itself.
- **Each panel carries an engraved illustration** via `<Illustration>` (`spot` variant) per the illustration contract — one for synthetic (an orrery / model of a crowd), one for field (surveyor's instrument). Generated in the house graphite style.
- **Tempo and proof become the visual spine** — large serif "Minutes" / "Weeks" and a proof line, so the trade-off is legible in two seconds without reading body copy.
- **Existing programmes move below the fold**: three most-recent programme chips with track badges plus "All programmes →". The full `ProgramsIndex` table stops competing with the gate; it lives under a collapsed/secondary section on this screen and stays fully available at its own view.
- **Track is visible forever after.** Once inside a programme, the header shows a track badge (Synthetic / Field / Blended) with a "change track" affordance, so the gate decision is never ambiguous later.
- **Explain contract**: the "Directional, not defensible" and "Citable evidence" claims get `<Explain id="research.proof.synthetic|field">` entries so a principal can interrogate what each standard of proof means.

## Files

| File | Change |
| --- | --- |
| `src/components/personas/TrackGateEntry.tsx` | Full rewrite — two-panel fork + confirm step, no inline form in the header |
| `src/components/personas/TrackConfirm.tsx` | New — name + visibility + create, scoped to the chosen track |
| `src/routes/_authenticated/admin/countries.$code.personas.index.tsx` | No-project branch becomes the gate screen; recent-programmes strip replaces the stacked `ProgramsIndex` |
| `src/components/personas/TrackTabs.tsx` | Add persistent track badge + change-track affordance |
| `src/lib/personas/tracks.ts` | Add `proof` explain ids, mark `blended` as secondary |
| `src/lib/explain/personas-entries.ts` | Register the two standard-of-proof rationales |
| `src/assets/illustrations/*.asset.json` | Two new engraved spots (synthetic public, field survey) |

Buttons use `btn-primary` / `btn-ghost`; all colour via registered tokens only.

## Verification

Playwright pass at 1280px and 390px: load the chamber with no project, screenshot the fork, click Field Programme, confirm the name step appears and creating lands on the field rail; repeat for Synthetic.
