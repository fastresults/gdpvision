// Ask — the country's Second Brain chat. Reuses Chamber 01's Ask-the-Ledger
// experience (front UI + back workflow) so ministers get the same tray-style
// Q&A, voice input, citations, expand actions, and grounded answers here as
// they do in Chamber 01.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AskTheLedger } from "@/components/ledger/AskTheLedger";
import { CARICOM_OECS_REGISTRY, flagUrl } from "@/lib/caricom-registry";
import { BrainMask } from "@/components/marketing/BrainMask";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/_authenticated/console/$code/ask")({
  head: () => ({
    meta: [
      { title: "Ask the Second Brain — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: AskPage,
});

function AskPage() {
  const { code } = Route.useParams();
  const country = CARICOM_OECS_REGISTRY.find((r) => r.code === code.toUpperCase());
  const countryName = country?.name ?? code.toUpperCase();
  const flag = flagUrl(code, "w160");

  return (
    <div className="relative min-h-[calc(100dvh-8rem)]">
      {/* Ambient empty-state hero — visible behind the chat tray */}
      <div className="pointer-events-none flex flex-col items-center gap-6 pt-4 text-center">
        <div className="relative h-[24rem] w-[24rem] sm:h-[32rem] sm:w-[32rem]">
          <BrainMask size={512} />
          {flag && (
            <img
              src={flag}
              alt={`Flag of ${countryName}`}
              className="absolute left-1/2 top-1/2 h-16 w-auto -translate-x-1/2 -translate-y-1/2 rounded shadow-md ring-1 ring-line-200"
            />
          )}
        </div>
        <p className="max-w-[20rem] text-sm leading-relaxed text-ink-500">
          Ask a question about {countryName} to get a quick, cited answer from your Second Brain.
        </p>
      </div>

      {/* Chamber 01 Ask-the-Ledger — full chat interface (front UI + back workflow) */}
      <AskTheLedger countryCode={code.toUpperCase()} countryName={countryName} defaultOpen />
    </div>
  );
}
