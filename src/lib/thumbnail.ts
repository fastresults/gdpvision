import type { ItemCategory } from "@/lib/items.functions";

/**
 * Returns a CDN-cached screenshot URL for the given page URL, or null
 * if the category should not get a website thumbnail (videos use their own poster).
 *
 * Uses Microlink's free screenshot API. `embed=screenshot.url` makes the
 * endpoint return the image bytes directly, so it slots straight into <img src>.
 */
export function getHeroThumbnail(url: string, category: ItemCategory): string | null {
  if (category === "videos" || category === "brand") return null;
  try {
    // Validate URL
    new URL(url);
  } catch {
    return null;
  }
  const params = new URLSearchParams({
    url,
    screenshot: "true",
    embed: "screenshot.url",
    "viewport.width": "1280",
    "viewport.height": "720",
    waitUntil: "networkidle0",
  });
  return `https://api.microlink.io/?${params.toString()}`;
}
