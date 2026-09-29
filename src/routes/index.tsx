import { createFileRoute } from "@tanstack/react-router";
import { MarketingHome } from "@/components/marketing/MarketingHome";
import ogImage from "@/assets/gdpvision-og.jpg";

const SITE_URL = "https://gdpvision.com";
const TITLE = "GDPVision — test national economic decisions before committing";
const DESCRIPTION =
  "A government-controlled decision system for Presidents, Prime Ministers and Cabinets: bring national evidence together, test choices before committing, and follow decisions through delivery.";

export const Route = createFileRoute("/")({
  head: () => {
    const absoluteOg = ogImage.startsWith("http") ? ogImage : `${SITE_URL}${ogImage}`;
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:url", content: SITE_URL + "/" },
        { property: "og:image", content: absoluteOg },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESCRIPTION },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: absoluteOg },
      ],
      links: [{ rel: "canonical", href: SITE_URL + "/" }],
    };
  },
  component: MarketingHome,
});
