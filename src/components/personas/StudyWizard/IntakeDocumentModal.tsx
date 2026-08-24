// Chamber 07 · Intake document viewer.
//
// Opens any gathered intake item — the governing source brief or a supporting
// context document — in a reading sheet. When the item has been filed into
// the second brain the sheet shows the full extracted text (not the truncated
// excerpt kept on the project row) and a link to the original file. Before
// filing, it falls back to the excerpt preview and says so.

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, ExternalLink } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getIntakeDocument } from "@/lib/personas/corpus-file.functions";
import type { WizardUpload } from "./MultimodalInput";

export function IntakeDocumentModal({
  projectId,
  item,
  role,
  onClose,
}: {
  projectId: string;
  item: WizardUpload | null;
  role: "brief" | "context";
  onClose: () => void;
}) {
  const open = !!item;
  const fetchDoc = useServerFn(getIntakeDocument);
  const { data, isLoading, error } = useQuery({
    queryKey: ["intake-doc", projectId, item?.path],
    queryFn: () => fetchDoc({ data: { projectId, path: item!.path } }),
    enabled: open,
  });

  const doc = data && data.filed ? data : null;
  const text = doc ? doc.text : (item?.excerpt ?? "");
  const isLink = !!item && /^https?:\/\//i.test(item.path);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500">
            {role === "brief" ? "Source brief" : "Supporting context"}
          </p>
          <SheetTitle className="font-serif text-xl leading-tight">{item?.name}</SheetTitle>
          <SheetDescription className="text-[12px]">
            {isLoading
              ? "Reading the document…"
              : doc
                ? `${(doc.chars || text.length).toLocaleString()} characters on file in the second brain`
                : "Preview — the first 8,000 characters. The full text files to the second brain on save."}
          </SheetDescription>
        </SheetHeader>

        {doc?.downloadUrl ? (
          <a
            href={doc.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary mt-4"
          >
            {isLink ? <ExternalLink size={12} /> : <Download size={12} />} Open original
          </a>
        ) : null}

        {error ? (
          <p className="mt-4 border border-red-500/40 bg-red-500/5 p-3 text-[12px] text-ink-800">
            Couldn&apos;t open this document — {(error as Error).message}
          </p>
        ) : null}

        <div className="mt-5 max-h-[70vh] overflow-y-auto whitespace-pre-wrap border border-line-200 bg-paper-50 p-4 font-mono text-[12px] leading-relaxed text-ink-800">
          {text ||
            (isLoading ? "" : "No readable text was extracted from this file.")}
        </div>

        {doc ? (
          <p className="mt-3 text-[11px] text-ink-500">
            Filed in the second brain — removing it from the intake list does not delete the filed
            copy.
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
