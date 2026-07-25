import { createFileRoute } from "@tanstack/react-router";

import { AskComposer } from "@/components/scenarios/v3/AskComposer";

export const Route = createFileRoute("/_authenticated/admin/countries/$code/scenarios/")({
  head: ({ params }) => ({
    meta: [
      { title: `What if… · ${params.code} — GDPVision` },
      {
        name: "description",
        content: `Ask a plain-English "what if" question and model the ripple across ${params.code}'s economy in seconds.`,
      },
      { property: "og:title", content: `Scenario Studio · ${params.code}` },
      { property: "og:description", content: "Rehearse a policy move without consequence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScenariosAsk,
});

function ScenariosAsk() {
  const { code } = Route.useParams();
  return <AskComposer code={code} />;
}
