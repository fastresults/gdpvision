import type { Item, ItemCategory } from "@/lib/items.functions";

/**
 * Decide what thumbnail (if any) to show for an item.
 *
 * - Videos use their own poster frame; return null.
 * - Brand category has no thumbnail.
 * - If the item has a saved thumbnail in storage (status === "ready"), use it.
 * - Otherwise return null so the UI shows a clean fallback / shimmer.
 */
export function getItemThumbnail(item: Item): string | null {
  if (item.category === "videos" || item.category === "brand") return null;
  if (item.thumbnail_status === "ready" && item.thumbnail_url) {
    return item.thumbnail_url;
  }
  return null;
}

export function shouldHaveThumbnail(category: ItemCategory): boolean {
  return category !== "videos" && category !== "brand";
}

/** Live mShots URL — used server-side during generation. */
export function mshotsUrl(url: string): string {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1200&h=750`;
}
