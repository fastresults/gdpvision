## Goal
Allow each item (especially Websites like "CIS-26") to have an optional long-form description that appears as a tooltip when hovering the button in the kiosk (e.g., "Caribbean Investment Summit").

## Database
New migration:
- `ALTER TABLE public.items ADD COLUMN tooltip text;`
- No new RLS/grants needed (column inherits table policies).

## Types & server functions (`src/lib/kiosk-types.ts`, `src/lib/items.functions.ts`)
- Add `tooltip: string | null` to the `Item` type.
- Include `tooltip` in the `listItems` select/mapping.
- Extend `createItem` and `updateItem` Zod schemas with `tooltip: z.string().max(300).optional().nullable()` and persist it.

## Admin UI (`src/routes/admin.tsx`)
- Add Tooltip state (`tooltip`, `setTooltip`) and an input field "Tooltip (optional)" in the Add form, available for all categories (most useful for Websites).
- Pass `tooltip` to `create` mutation; reset on success.
- In edit row, add `editTooltip` field and pass to `update`.
- Show the tooltip text under the label in the list row as a muted hint.

## Kiosk rendering
Wrap each item button with shadcn `Tooltip` (already available at `@/components/ui/tooltip`) when `item.tooltip` is non-empty.

- `src/routes/index.tsx` — desktop nav buttons: wrap with `TooltipProvider`/`Tooltip`/`TooltipTrigger asChild`/`TooltipContent`. Show `item.tooltip`.
- `src/components/mobile/MobileKiosk.tsx` — same wrap on the item tiles. On touch devices, the Radix tooltip opens on long-press; acceptable fallback (no extra UI clutter).

## Out of scope
- No change to PDF viewer, thumbnails, or routing.
- No required field; existing items remain unchanged with `tooltip = null`.

## Verification
- Add a Websites item "CIS-26" with tooltip "Caribbean Investment Summit"; hover in kiosk → tooltip appears. Items without tooltip behave exactly as today.
