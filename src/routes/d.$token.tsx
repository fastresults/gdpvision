// The client's reading room. No account, no navigation, no platform chrome —
// the dossier and its presentation, addressed to the client who commissioned
// them. Everything on this page comes from the governing brief.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Presentation, Printer } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { printSurface } from "@/components/print/PrintSurface";
import { DeckModal } from "@/components/personas/field/deck/DeckModal";
import { BriefOpenerBlock } from "@/components/personas/field/briefing/BriefOpenerBlock";

import {
  BRIEFING_PRINT_SURFACE,
  DEFAULT_BRIEFING_PRINT_CONFIG,
  PrintableBriefing,
} from "@/components/personas/field/briefing/PrintableBriefing";
import type { CommencementBriefing } from "@/lib/personas/commencement-briefing.functions";
import type { ProgrammeDeck } from "@/lib/personas/programme-deck.functions";

interface Resolved {
  state: "ok" | "invalid" | "revoked" | "unavailable" | "error";
  briefing?: CommencementBriefing;
  deck?: ProgrammeDeck | null;
}

export const Route = createFileRoute("/d/$token")({
  head: () => ({
    meta: [
      { title: "Programme dossier" },
      {
        name: "description",
        content:
          "The commencement dossier for a commissioned research programme: the brief as understood, the approach, the participants, the instruments and the fieldwork.",
      },
      { property: "og:title", content: "Programme dossier" },
      {
        property: "og:description",
        content: "The commencement dossier for a commissioned research programme.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicDossier,
});

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-20">
      <h1 className="font-serif text-3xl text-ink-950">{title}</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-700">{body}</p>
    </main>
  );
}

function PublicDossier() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Resolved | null>(null);
  const [deckOpen, setDeckOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/public/dossier/${encodeURIComponent(token)}`);
        const body = (await res.json()) as Resolved;
        if (alive) setData(body);
      } catch {
        if (alive) setData({ state: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-24 text-ink-500">
        <Loader2 size={16} className="animate-spin" /> Opening the dossier…
      </main>
    );
  }

  if (data.state === "revoked") {
    return (
      <Notice
        title="This link is no longer active"
        body="The dossier behind this link has been withdrawn. Please contact your programme lead for a current copy."
      />
    );
  }

  if (data.state !== "ok" || !data.briefing) {
    return (
      <Notice
        title="We could not open this dossier"
        body="This link is not recognised. Please check the address, or ask your programme lead to send a new one."
      />
    );
  }

  const doc = data.briefing;
  const deck = data.deck ?? null;
  const source = doc.source;

  return (
    <div className="min-h-screen bg-paper-50">
      <main className="mx-auto w-full max-w-5xl px-5 py-12 sm:py-16">
        <header className="border-b border-line-200 pb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            {source.preparedFor ? `Prepared for ${source.preparedFor}` : "Commencement dossier"}
          </p>
          <h1 className="mt-2 font-serif text-[32px] leading-[1.12] text-ink-950 sm:text-4xl">
            {doc.title}
          </h1>
          {doc.subtitle ? (
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-700">
              {doc.subtitle}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                printSurface(BRIEFING_PRINT_SURFACE, {
                  title: `${doc.programmeTitle} — Commencement Briefing`,
                })
              }
              className="btn-secondary inline-flex items-center gap-2"
            >
              <Printer size={14} /> Print / save as PDF
            </button>
            {deck ? (
              <button
                type="button"
                onClick={() => setDeckOpen(true)}
                className="btn-accent inline-flex items-center gap-2"
              >
                <Presentation size={14} /> Presentation
              </button>
            ) : null}
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
          <nav className="lg:sticky lg:top-6 lg:self-start">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              Contents
            </p>
            <ol className="mt-3 space-y-1">
              {doc.sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#cb-${s.id}`}
                    onClick={() => setActive(s.id)}
                    className={`flex gap-3 border-l-2 py-1.5 pl-3 text-sm transition-colors ${
                      active === s.id
                        ? "border-gold-500 text-ink-950"
                        : "border-line-200 text-ink-700 hover:border-ink-300 hover:text-ink-950"
                    }`}
                  >
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-8">
            {doc.sections.map((s, i) => (
              <article key={s.id} id={`cb-${s.id}`} className="scroll-mt-24">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
                  {s.eyebrow}
                </p>
                <h2 className="mt-1 flex items-baseline gap-3 font-serif text-2xl text-ink-950">
                  <span className="font-mono text-xs text-gold-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.heading}
                </h2>
                {s.opener ? (
                  <BriefOpenerBlock opener={s.opener} variant="screen" />
                ) : (
                  <div className="cb-public-prose mt-4 max-w-none text-[15px] leading-relaxed text-ink-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.body_md}</ReactMarkdown>
                  </div>
                )}

              </article>
            ))}
          </div>
        </div>

        <footer className="mt-14 border-t border-line-200 pt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {source.preparedBy ? `Prepared by ${source.preparedBy}` : "Confidential"} · v
            {doc.version}
          </p>
        </footer>
      </main>

      <style>{PROSE_CSS}</style>
      <PrintableBriefing briefing={doc} config={DEFAULT_BRIEFING_PRINT_CONFIG} />
      <DeckModal open={deckOpen} deck={deck} onClose={() => setDeckOpen(false)} />
    </div>
  );
}

const PROSE_CSS = `
.cb-public-prose h3 { font-size: 1rem; font-weight: 600; margin: 1.6rem 0 0.5rem; }
.cb-public-prose p { margin: 0 0 0.85rem; }
.cb-public-prose ul, .cb-public-prose ol { margin: 0 0 1rem 1.1rem; list-style: disc; }
.cb-public-prose ol { list-style: decimal; }
.cb-public-prose li { margin: 0 0 0.35rem; }
.cb-public-prose hr { margin: 1.5rem 0; border-top: 1px solid var(--color-line-200); }
.cb-public-prose blockquote { border-left: 2px solid var(--color-line-200); padding-left: 1rem; font-style: italic; margin: 0 0 1rem; }
.cb-public-prose table { width: 100%; border-collapse: collapse; margin: 0 0 1rem; font-size: 0.85rem; display: block; overflow-x: auto; }
.cb-public-prose th { text-align: left; font-family: ui-monospace, monospace; font-size: 0.62rem; letter-spacing: 0.16em; text-transform: uppercase; padding: 0.4rem 0.75rem 0.4rem 0; border-bottom: 1px solid currentColor; white-space: nowrap; }
.cb-public-prose td { padding: 0.5rem 0.75rem 0.5rem 0; border-bottom: 1px solid var(--color-line-200); vertical-align: top; }
`;
