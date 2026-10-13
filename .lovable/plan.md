# Introduce homepage scrollers with one gentle sideways reveal

## Recommended approach
Give each of the two pictured sections a **single, slow, one-panel movement to the left** when its content first becomes clearly visible. This demonstrates that more information sits to the right without turning either section into a continuously moving carousel.

The introduction triggers whether visitors arrive by scrolling **down or up**. It runs once per section per page visit; returning to a section preserves the visitor’s position rather than repeating the movement.

## What changes
- **The measures investors read first:** move the existing horizontal row forward by exactly one card plus its gap—not a full viewport. The next card settles into alignment, and the previous card remains reachable with the left arrow.
- **The Moment / eight regional exposures:** slide the current panel fully left while the next panel enters from the right. This is an actual horizontal transition, not the current fade or an entrance animation of the whole section. Keep the arrows stationary and move the illustration, heading, copy and associated figures together.
- Use approximately **2.4 seconds** with gentle easing, followed by a complete stop. Keep the section’s height stable during the transition so the page does not jump.
- Start only when the card row or main exposure panel—not merely its section heading—is substantially visible. On tall phone panels, use a viewport-relative visibility trigger so the introduction can still run.
- Preserve all current copy, logos, illustrations, links, statistics and manual navigation.

## Visitor control and accessibility
- An arrow click, horizontal swipe, horizontal trackpad movement or keyboard navigation takes priority and cancels the automatic introduction. Do not restart it afterward.
- If the visitor is hovering over content or has keyboard focus inside it when the reveal is due, skip the introduction rather than moving what they are reading.
- If the section leaves view during movement, stop safely and retain a valid panel position; do not continue unseen or replay on return.
- Respect reduced-motion preferences: omit the automatic movement and keep the existing arrows and swipe controls.
- Do not hijack vertical page scrolling, pin the section to the screen, add a repeating timer or alter the homepage’s other animations.

## Technical implementation
- Add a small shared browser-side entry-introduction hook with visibility detection, once-per-mount state, cancellation and cleanup. The existing `useInView` hook is a one-time visibility detector, but the new behavior also needs interaction cancellation and viewport-aware triggering.
- In `src/components/marketing/IndexBand.tsx`, animate the real scroll position with a measured card-width step; coordinate scroll snapping with the animation and restore it afterward.
- In `src/components/marketing/MarketingHome.tsx`, give the regional-exposure panel a clipped horizontal transition track with outgoing/incoming panels and a stable shared height. Commit the next `momentIndex` once and prevent overlapping transitions.
- Keep motion timing and any styling in the existing design system; record the shared interaction convention in `AGENTS.md` during implementation.
- No server, data, permission or publishing changes.

## Verification
- Enter each section from above and, in a fresh page visit, from below; confirm one full panel moves left and stops.
- Revisit after completion and confirm no repeat or position reset.
- Interrupt with arrows, touch, trackpad and keyboard; confirm manual control wins and all panels remain accessible.
- Test fast scrolling, leaving mid-transition, resizing and reduced motion.
- Inspect desktop and phone layouts for stable height, complete content, accurate arrow states and no horizontal page overflow.