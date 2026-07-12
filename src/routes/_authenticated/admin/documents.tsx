import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getDocumentHtml, listDocuments } from "@/lib/documents.functions";
import { Wordmark } from "@/components/marketing/Wordmark";

const docsQuery = queryOptions({ queryKey: ["documents"], queryFn: () => listDocuments() });

export const Route = createFileRoute("/_authenticated/admin/documents")({
  head: () => ({
    meta: [
      { title: "Documents — GDPVision" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(docsQuery),
  component: DocsPage,
});

function DocsPage() {
  const { data: rows } = useSuspenseQuery(docsQuery);
  const get = useServerFn(getDocumentHtml);
  const [preview, setPreview] = useState<{ id: string; title: string; html: string } | null>(null);

  async function open(id: string) {
    const doc = await get({ data: { id } });
    setPreview({ id: doc.id, title: doc.title, html: doc.html });
  }

  return (
    <div className="min-h-screen bg-paper-0 text-ink-950">
      <header className="flex items-center justify-between border-b border-line-200 px-8 py-5">
        <div className="flex items-center gap-10">
          <Link to="/instrument"><Wordmark /></Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">Admin · Documents</span>
        </div>
        <Link to="/admin" className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950">← Admin</Link>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-16">
        <h1 className="font-serif text-4xl">Exported documents</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-500">
          Rendered artifacts from Cabinet decisions, Briefing packs, FDI packages, Term reports, and State-of-the-Mandate briefings. Preview inline; use the browser's print dialog to save as PDF.
        </p>

        {rows.length === 0 ? (
          <p className="mt-14 border border-dashed border-line-200 p-12 text-center text-sm text-ink-500">
            No documents rendered yet.
          </p>
        ) : (
          <ul className="mt-10 divide-y divide-line-200 border-y border-line-200">
            {rows.map((r) => (
              <li key={r.id} className="grid grid-cols-[auto_1fr_auto_auto] items-baseline gap-6 py-4 text-sm">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">{r.kind}</span>
                <span>{r.title}</span>
                <span className="font-mono text-[10px] text-ink-500">{new Date(r.rendered_at).toLocaleString()}</span>
                <button onClick={() => open(r.id)} className="font-mono text-[10px] uppercase tracking-widest text-ink-500 hover:text-ink-950">Preview</button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {preview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper-0/95 p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">{preview.title}</span>
            <div className="flex gap-4 font-mono text-[10px] uppercase tracking-widest">
              <button
                onClick={() => {
                  const w = window.open("", "_blank");
                  if (w) { w.document.write(preview.html); w.document.close(); w.print(); }
                }}
                className="hover:text-ink-950"
              >
                Print
              </button>
              <button onClick={() => setPreview(null)} className="hover:text-red-600">Close</button>
            </div>
          </div>
          <iframe title={preview.title} srcDoc={preview.html} className="flex-1 border border-line-200 bg-white" />
        </div>
      )}
    </div>
  );
}
