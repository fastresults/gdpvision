import { createFileRoute } from "@tanstack/react-router";

import { PresentDeck } from "@/components/present/PresentDeck";

const SITE_URL = "https://gdpvision.com";
const TITLE = "GDPVision — the live briefing";
const DESCRIPTION =
  "A walk through GDPVision for a room: what it is, why we built it, how the Second Brain is fed, the ten chambers one at a time, and the GDP event series.";

export const Route = createFileRoute("/present")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/present` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/present` }],
    // Runs in <head> before any viewer exists: stamps each embedded page the
    // moment it finishes, so LiveFrame never misses a load that happened
    // before the briefing became interactive.
    headScripts: [
      {
        children:
          "document.addEventListener('load',function(e){var t=e.target;if(t&&t.tagName==='IFRAME')t.setAttribute('data-loaded',String(Date.now()))},true);",
      },
    ],
  }),
  component: PresentDeck,
});
