import { createFileRoute } from "@tanstack/react-router";
import { MarketingHome } from "@/components/marketing/MarketingHome";
import ogImage from "@/assets/gdpvision-og.jpg";

const SITE_URL = "https://gdpvision.com";
const TITLE = "GDPVision — The world's first GDP-elevation instrument";
const DESCRIPTION =
  "Purpose-built for Presidents, Prime Ministers and Cabinets. Turn public and private national data into decisions that elevate GDP — across seven sovereign chambers.";

export const Route = createFileRoute("/")({
  head: () => {
    const absoluteOg = ogImage.startsWith("http") ? ogImage : `${SITE_URL}${ogImage}`;
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:url", content: SITE_URL + "/" },
        { property: "og:image", content: absoluteOg },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESCRIPTION },
        { name: "twitter:image", content: absoluteOg },
      ],
      links: [{ rel: "canonical", href: SITE_URL + "/" }],
    };
  },
  component: MarketingHome,
});
