// The client's presentation room. No account, no navigation, no platform
// chrome — only the presentation the client commissioned, on its own address.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { DeckModal } from "@/components/personas/field/deck/DeckModal";
import type { ProgrammeDeck } from "@/lib/personas/programme-deck.functions";

type Payload = { state: string; deck?: ProgrammeDeck | null };

export const Route = createFileRoute("/p/$token")({
  head: () => ({
    meta: [
      { title: "Presentation" },
      { name: "description", content: "A presentation prepared for you." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Presentation" },
      { property: "og:description", content: "A presentation prepared for you." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicDeckPage,
});

function PublicDeckPage() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let live = true;
    void fetch(`/api/public/deck/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((body: Payload) => {
        if (live) setData(body);
      })
      .catch(() => {
        if (live) setData({ state: "invalid" });
      });
    return () => {
      live = false;
    };
  }, [token]);

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-24 text-ink-500">
        <Loader2 size={16} className="animate-spin" /> Opening the presentation…
      </main>
    );
  }

  if (data.state === "revoked") {
    return (
      <Notice
        title="This link is no longer active"
        body="The presentation behind this link has been withdrawn. Please contact your programme lead for a current copy."
      />
    );
  }

  if (data.state !== "ok" || !data.deck) {
    return (
      <Notice
        title="We could not open this presentation"
        body="This link is not recognised. Please check the address, or ask your programme lead to send a new one."
      />
    );
  }

  return (
    <div className="min-h-screen bg-ink-950">
      <h1 className="sr-only">{data.deck.programmeTitle}</h1>
      <DeckModal open deck={data.deck} unbranded />
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-24">
      <h1 className="font-serif text-2xl text-ink-950">{title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-700">{body}</p>
    </main>
  );
}
