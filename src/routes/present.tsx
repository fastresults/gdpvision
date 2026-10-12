import { createFileRoute } from "@tanstack/react-router";

import { PresentDeck } from "@/components/present/PresentDeck";

const SITE_URL = "https://gdpvision.com";
const TITLE = "GDPVision — the live briefing";
const DESCRIPTION =
  "A walk through GDPVision for a room: what it is, why we built it, how the Second Brain is fed, the ten chambers one at a time, and the GDP event series.";
const VIEWER_ORIGINS = [
  "https://atg.gdpvision.com",
  "https://gdp-event.gdpvision.com",
  "https://blue-economy.gdpvision.com",
  "https://cadis.gdpvision.com",
  "https://housing.gdpvision.com",
  "https://agriculture.gdpvision.com",
  "https://caribbeaninvestmentsummit.com",
  "https://energy.gdpvision.com",
  "https://public-works.gdpvision.com",
  "https://commerce.gdpvision.com",
  "https://health.gdpvision.com",
];

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
    links: [
      { rel: "canonical", href: `${SITE_URL}/present` },
      ...VIEWER_ORIGINS.map((href) => ({
        rel: "preconnect",
        href,
        crossOrigin: "anonymous" as const,
      })),
    ],
  }),
  component: PresentDeck,
});
