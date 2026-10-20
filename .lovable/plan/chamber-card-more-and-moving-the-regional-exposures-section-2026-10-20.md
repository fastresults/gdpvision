# Chamber card "more..." and moving the regional exposures section

## 1. "more..." on all ten Chamber cards
- Each card shows the image, Chamber name, promise line and description. The two bullet points start hidden.
- A "more..." link sits right after the last full stop of the description, in the Chamber's colour.
- Clicking it reveals the bullets with a short, gentle slide-down, and the link changes to "less" so the bullets can be hidden again.
- Each card opens on its own. Opening one card does not change the height of the other cards in its row.
- Keyboard and screen-reader friendly. When the visitor has turned off motion on their device, the bullets appear without the slide.

Recommended because a single shared change covers all ten cards, keeps them equal and compact, and keeps the detail one click away.

## 2. Move the "The moment · Eight regional exposures" section
- Move the whole rotating exposures section (CBI revenue, hurricanes, tourism and the rest) from just below the measuring-body logos to the very bottom of the homepage, after the "briefing" section and just above the footer.
- Its content, rotation and sources stay the same. It keeps its own page anchor, so existing links to it still work.

Recommended because, at the bottom, the regional risks become a closing reason to act after visitors have seen the solution. The page then moves from the headline and logos straight into the ten Chambers.

## Technical details
- `src/components/marketing/ChamberPanel.tsx`: add local `open` state; render the description with an inline button (`aria-expanded`, `aria-controls`) after it; bullets in a grid-rows `0fr -> 1fr` transition wrapper with `motion-reduce:transition-none`; give cards `items-start` in the grid so their heights are independent.
- `src/components/marketing/MarketingHome.tsx`: cut the `<section id="problem">` block and paste it after `<section id="briefing">`, keeping `id="problem"`.
