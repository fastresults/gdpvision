import { createFileRoute } from "@tanstack/react-router";
import { MarketingHome } from "@/components/marketing/MarketingHome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GDP Vision — Immersive presentation systems" },
      {
        name: "description",
        content:
          "GDP Vision builds full-screen briefing environments for Caribbean summits, ministries, and enterprises.",
      },
      { property: "og:title", content: "GDP Vision" },
      {
        property: "og:description",
        content: "Immersive presentation systems for the Caribbean's next decade.",
      },
    ],
  }),
  component: MarketingHome,
});
