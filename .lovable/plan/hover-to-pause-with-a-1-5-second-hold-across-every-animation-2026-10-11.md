# Hover-to-pause with a 1.5-second hold, across every animation

## What changes for the viewer

- Moving the mouse across an animation no longer stops it. It keeps playing.
- If the mouse **rests on a card or stage for 1.5 seconds**, the animation pauses on that element (and shows its detail, as today).
- When the mouse **leaves**, the animation resumes right away from where it stopped. It doesn't restart.
- If the mouse comes back, the same rule applies: another 1.5 seconds of resting before it pauses again.
- Moving from one card straight onto another starts a fresh 1.5-second count for the new card.
- Keyboard users pause straight away on focus (no wait), because they are choosing on purpose. Touch taps work as they do now.
- A faint gold ring fills around the card during the 1.5 seconds, so the viewer can see the pause coming. With reduced motion turned on, the ring doesn't animate and the still view stays as it is.

## Where it applies

1. Homepage hero ring of Chambers (puzzle-piece ring)
2. Homepage chamber screenshot carousel area
3. National Custody Relay (homepage)
4. Decision Dividend Engine (Decision Brief)
5. Sovereign Decision Circuit and Sovereign Custody Seal (Vault)
6. Data & Decision Flow map: hovering a box pauses after 1.5 s. Clicking still pauses immediately.
7. By Chamber journeys: hovering the stage, the Chamber grid, dossier cards or benefits pauses after 1.5 s. The Pause/Play button still works as it does now.

## Technical details

- New hook `src/hooks/useHoverIntentPause.ts`: `useHoverIntentPause({ delay = 1500 })` returns `{ paused, bind(key) }`. `bind` supplies `onPointerEnter` (start the timer, but only for `pointerType === "mouse"`), `onPointerLeave` (clear the timer and resume), `onFocus`/`onBlur` (pause immediately) and `data-intent="pending|paused"`. It cleans up its timers when the component unmounts.
- Replace the direct `onMouseEnter → setActive` / `setPaused(true)` in the seven components listed above with the hook. `active` is only set once the hold completes. The existing `*-paused` classes and the scheduler logic stay as they are.
- In `DataDecisionFlow` and `ChamberDecisionJourneys`, a hover pause is kept separate from the user's Play/Pause choice: the animation runs only if `playing && !hoverPaused && !selected`.
- One shared CSS utility, `.hover-intent[data-intent="pending"]`, draws a 1.5 s gold outline fill using existing tokens, and is turned off under `prefers-reduced-motion`.
- Check in the browser at 1399×936: a quick sweep doesn't pause; a 1.6 s rest pauses; leaving resumes; no console errors.
