import type { ItemCategory } from "@/lib/items.functions";

/**
 * Returns a CDN-cached screenshot URL for the given page URL, or null
 * if the category should not get a website thumbnail (videos use their own poster).
 *
 * Uses WordPress.com's mShots service — free, no API key, no rate limit,
 * globally cached. First request for a new URL returns a placeholder while
 * the screenshot generates (usually 5-15s); subsequent requests are instant.
 */
export function getHeroThumbnail(url: string, category: ItemCategory): string | null {
  if (category === "videos" || category === "brand") return null;
  try {
    new URL(url);
  } catch {
    return null;
  }
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=800&h=500`;
}
