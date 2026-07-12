import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemoryDraftReview, type MemoryDraft } from "@/components/country-data/MemoryDraftReview";
import {
  bulkUpsertMemory,
  extractMemoriesFromSourceId,
  extractMemoriesFromText,
  extractMemoriesFromUrl,
  ingestDocumentSource,
  listSources,
  upsertMemory,
} from "@/lib/country-data/manage.functions";

const KINDS = ["audience", "position", "statement", "outlet", "precedent", "fact", "risk"];
const DEFAULT_SECTOR = "cross_cutting";

type Props = {
  countryCode: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
};

export function AddMemoryDialog({ countryCode, open, onClose, onDone }: Props) {
  const handleClose = () => onClose();
  const done = () => { onDone(); };
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Add memory · {countryCode}</DialogTitle>
          <DialogDescription>
            Add memories manually, paste in bulk, drop documents, ingest a URL, mine an existing
            source, or paste an API/MCP response. AI-extracted drafts land in a review pane before commit.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="manual" className="mt-4">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="bulk">Bulk paste</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="url">URL</TabsTrigger>
            <TabsTrigger value="source">From source</TabsTrigger>
            <TabsTrigger value="api">API / MCP</TabsTrigger>
          </TabsList>
          <TabsContent value="manual" className="mt-4">
            <ManualTab countryCode={countryCode} onDone={done} />
          </TabsContent>
          <TabsContent value="bulk" className="mt-4">
            <BulkPasteTab countryCode={countryCode} onDone={done} onClose={handleClose} />
          </TabsContent>
          <TabsContent value="documents" className="mt-4">
            <DocumentsTab countryCode={countryCode} onDone={done} onClose={handleClose} />
          </TabsContent>
          <TabsContent value="url" className="mt-4">
            <UrlTab countryCode={countryCode} onDone={done} onClose={handleClose} />
          </TabsContent>
          <TabsContent value="source" className="mt-4">
            <FromSourceTab countryCode={countryCode} onDone={done} onClose={handleClose} />
          </TabsContent>
          <TabsContent value="api" className="mt-4">
            <ApiMcpTab countryCode={countryCode} onDone={done} onClose={handleClose} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Manual ----------
function ManualTab({ countryCode, onDone }: { countryCode: string; onDone: () => void }) {
  const upsert = useServerFn(upsertMemory);
  const [sector, setSector] = useState(DEFAULT_SECTOR);
  const [kind, setKind] = useState("position");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [weight, setWeight] = useState(3);
  const [verified, setVerified] = useState(false);
  const [scope, setScope] = useState<"country" | "national">("country");
  const mut = useMutation({
    mutationFn: async () =>
      upsert({ data: { countryCode: scope === "national" ? countryCode : countryCode, sector_code: sector, kind, title, body, weight, verified } }),
    onSuccess: () => { setTitle(""); setBody(""); onDone(); },
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <input required value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Sector code" className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0">
          {KINDS.map((k) => <option key={k}>{k}</option>)}
        </select>
        <select value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0">
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>weight {n}</option>)}
        </select>
        <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0">
          <option value="country">country scope</option>
          <option value="national">national scope</option>
        </select>
      </div>
      <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      <textarea required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body" rows={5} className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-xs">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          Mark verified
        </label>
        <span className="text-xs text-ink-500 ml-auto">{body.length} chars</span>
      </div>
      {mut.error && <p className="text-xs text-red-600">{(mut.error as Error).message}</p>}
      <button disabled={mut.isPending} className="w-full px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50">
        {mut.isPending ? "Adding…" : "Add memory"}
      </button>
    </form>
  );
}

// ---------- Bulk paste ----------
function BulkPasteTab({ countryCode, onDone, onClose }: { countryCode: string; onDone: () => void; onClose: () => void }) {
  const bulk = useServerFn(bulkUpsertMemory);
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<MemoryDraft[] | null>(null);
  const [busy, setBusy] = useState(false);

  const parse = () => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const out: MemoryDraft[] = [];
    for (const line of lines) {
      // format: sector | kind | title :: body
      const [head, body] = line.split("::").map((s) => s.trim());
      const parts = head.split("|").map((s) => s.trim());
      if (parts.length >= 3 && body) {
        out.push({ sector_code: parts[0], kind: parts[1], title: parts[2], body, weight: 3, _keep: true });
      } else {
        // fallback: whole line is a fact
        out.push({ sector_code: DEFAULT_SECTOR, kind: "fact", title: line.slice(0, 120), body: line, weight: 3, _keep: true });
      }
    }
    setDrafts(out);
  };

  const commit = async () => {
    if (!drafts) return;
    setBusy(true);
    try {
      const items = drafts.filter((d) => d._keep !== false).map(({ _keep, ...rest }) => rest);
      await bulk({ data: { countryCode, items } });
      setText("");
      setDrafts(null);
      onDone();
      onClose();
    } finally { setBusy(false); }
  };

  if (drafts) {
    return (
      <div className="space-y-3">
        <MemoryDraftReview drafts={drafts} setDrafts={setDrafts} onCommit={commit} busy={busy} />
        <button onClick={() => setDrafts(null)} className="text-xs text-ink-500 underline">← Back to paste</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">
        One memory per line. Structured format: <span className="font-mono">sector | kind | title :: body</span>.
        Plain lines become <span className="font-mono">cross_cutting / fact</span> — edit in the review step.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={"health | position | Universal PHC by 2030 :: The Ministry commits to universal primary care coverage by 2030…\nfinance | fact | Debt-to-GDP 78% (2025) :: Central bank Q3 report."}
        className="w-full border border-line-200 px-2 py-1.5 text-sm font-mono bg-paper-0"
      />
      <button
        onClick={parse}
        disabled={!text.trim()}
        className="w-full px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50"
      >
        Preview {text.split("\n").filter((l) => l.trim()).length} memories
      </button>
    </div>
  );
}

// ---------- Documents ----------
function DocumentsTab({ countryCode, onDone, onClose }: { countryCode: string; onDone: () => void; onClose: () => void }) {
  const ingest = useServerFn(ingestDocumentSource);
  const extractFromSource = useServerFn(extractMemoriesFromSourceId);
  const bulk = useServerFn(bulkUpsertMemory);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sectorHint, setSectorHint] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<MemoryDraft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setErr(null); setProgress(null);
    try {
      const collected: MemoryDraft[] = [];
      for (const f of files) {
        setProgress(`Uploading + extracting ${f.name}…`);
        const b64 = await fileToBase64(f);
        const res: any = await ingest({
          data: {
            countryCode,
            filename: f.name,
            mime_type: f.type || "application/octet-stream",
            content_b64: b64,
            title: f.name,
            org: "Uploaded document",
          },
        });
        const ext: any = await extractFromSource({ data: { countryCode, sourceId: res.id, sectorHint: sectorHint || undefined } });
        for (const d of ext.drafts ?? []) {
          collected.push({ ...d, _keep: true, source_id: res.id, citation_url: ext.source?.url ?? null });
        }
      }
      setDrafts(collected);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  const commit = async () => {
    if (!drafts) return;
    setBusy(true);
    try {
      const items = drafts.filter((d) => d._keep !== false).map(({ _keep, ...rest }) => rest);
      if (items.length) await bulk({ data: { countryCode, items } });
      setFiles([]); setDrafts(null);
      onDone(); onClose();
    } finally { setBusy(false); }
  };

  if (drafts) {
    return (
      <div className="space-y-3">
        <MemoryDraftReview drafts={drafts} setDrafts={setDrafts} onCommit={commit} busy={busy} sourceHint={`${files.length} document${files.length === 1 ? "" : "s"}`} />
        <button onClick={() => setDrafts(null)} className="text-xs text-ink-500 underline">← Back to upload</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)].slice(0, 10));
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed p-8 text-center cursor-pointer ${dragOver ? "border-ink-950 bg-paper-100" : "border-line-200"}`}
      >
        <p className="text-sm">Drop files here or click to browse</p>
        <p className="text-xs text-ink-500 mt-1">PDF, DOCX, TXT, MD · up to 10 files · AI extracts memories with provenance</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])].slice(0, 10))}
        />
      </div>
      {files.length > 0 && (
        <ul className="text-xs space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex justify-between border border-line-200 px-2 py-1">
              <span className="truncate">{f.name}</span>
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-red-600">✕</button>
            </li>
          ))}
        </ul>
      )}
      <input
        placeholder="Sector hint (optional, e.g. health, finance)"
        value={sectorHint}
        onChange={(e) => setSectorHint(e.target.value)}
        className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0"
      />
      {progress && <p className="text-xs text-ink-500">{progress}</p>}
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        onClick={run}
        disabled={busy || files.length === 0}
        className="w-full px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50"
      >
        {busy ? "Working…" : `Extract memories from ${files.length || ""} file${files.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}

// ---------- URL ----------
function UrlTab({ countryCode, onDone, onClose }: { countryCode: string; onDone: () => void; onClose: () => void }) {
  const extract = useServerFn(extractMemoriesFromUrl);
  const bulk = useServerFn(bulkUpsertMemory);
  const [url, setUrl] = useState("");
  const [sectorHint, setSectorHint] = useState("");
  const [drafts, setDrafts] = useState<MemoryDraft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setErr(null);
    try {
      const res: any = await extract({ data: { countryCode, url, sectorHint: sectorHint || undefined } });
      setDrafts((res.drafts ?? []).map((d: any) => ({ ...d, _keep: true, citation_url: url })));
    } catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setBusy(false); }
  };

  const commit = async () => {
    if (!drafts) return;
    setBusy(true);
    try {
      const items = drafts.filter((d) => d._keep !== false).map(({ _keep, ...rest }) => rest);
      if (items.length) await bulk({ data: { countryCode, items } });
      setUrl(""); setDrafts(null); onDone(); onClose();
    } finally { setBusy(false); }
  };

  if (drafts) {
    return (
      <div className="space-y-3">
        <MemoryDraftReview drafts={drafts} setDrafts={setDrafts} onCommit={commit} busy={busy} sourceHint={url} />
        <button onClick={() => setDrafts(null)} className="text-xs text-ink-500 underline">← Back</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">Fetches the page server-side, strips markup, and asks the AI to extract atomic memories.</p>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      <input value={sectorHint} onChange={(e) => setSectorHint(e.target.value)} placeholder="Sector hint (optional)" className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        onClick={run}
        disabled={busy || !url.trim()}
        className="w-full px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50"
      >
        {busy ? "Extracting…" : "Extract memories from URL"}
      </button>
    </div>
  );
}

// ---------- From source ----------
function FromSourceTab({ countryCode, onDone, onClose }: { countryCode: string; onDone: () => void; onClose: () => void }) {
  const list = useServerFn(listSources);
  const extractFromSource = useServerFn(extractMemoriesFromSourceId);
  const bulk = useServerFn(bulkUpsertMemory);
  const { data: sources = [] } = useQuery({
    queryKey: ["data", countryCode, "sources-picker"],
    queryFn: () => list({ data: { countryCode } }),
  });
  const [sourceId, setSourceId] = useState<string>("");
  const [sectorHint, setSectorHint] = useState("");
  const [drafts, setDrafts] = useState<MemoryDraft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [srcLabel, setSrcLabel] = useState("");

  const run = async () => {
    if (!sourceId) return;
    setBusy(true); setErr(null);
    try {
      const res: any = await extractFromSource({ data: { countryCode, sourceId, sectorHint: sectorHint || undefined } });
      setSrcLabel(res.source ? `${res.source.title} — ${res.source.org}` : "");
      setDrafts((res.drafts ?? []).map((d: any) => ({ ...d, _keep: true, source_id: sourceId, citation_url: res.source?.url ?? null })));
    } catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setBusy(false); }
  };

  const commit = async () => {
    if (!drafts) return;
    setBusy(true);
    try {
      const items = drafts.filter((d) => d._keep !== false).map(({ _keep, ...rest }) => rest);
      if (items.length) await bulk({ data: { countryCode, items } });
      setDrafts(null); onDone(); onClose();
    } finally { setBusy(false); }
  };

  if (drafts) {
    return (
      <div className="space-y-3">
        <MemoryDraftReview drafts={drafts} setDrafts={setDrafts} onCommit={commit} busy={busy} sourceHint={srcLabel} />
        <button onClick={() => setDrafts(null)} className="text-xs text-ink-500 underline">← Back</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">Mine memories from a source already ingested for this country. Uses stored chunks — no re-upload.</p>
      <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0">
        <option value="">— select source —</option>
        {(sources as any[]).map((s) => (
          <option key={s.id} value={s.id}>
            {s.title} · {s.org} · {s._doc_chunks ?? 0} chunks
          </option>
        ))}
      </select>
      <input value={sectorHint} onChange={(e) => setSectorHint(e.target.value)} placeholder="Sector hint (optional)" className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        onClick={run}
        disabled={busy || !sourceId}
        className="w-full px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50"
      >
        {busy ? "Extracting…" : "Extract memories from source"}
      </button>
    </div>
  );
}

// ---------- API / MCP paste ----------
function ApiMcpTab({ countryCode, onDone, onClose }: { countryCode: string; onDone: () => void; onClose: () => void }) {
  const extractFromText = useServerFn(extractMemoriesFromText);
  const bulk = useServerFn(bulkUpsertMemory);
  const list = useServerFn(listSources);
  const { data: sources = [] } = useQuery({
    queryKey: ["data", countryCode, "connections-picker"],
    queryFn: () => list({ data: { countryCode } }),
  });
  const connections = (sources as any[]).filter((s) => s.connection_kind === "api" || s.connection_kind === "mcp");

  const [connectionId, setConnectionId] = useState<string>("");
  const [payload, setPayload] = useState("");
  const [sectorHint, setSectorHint] = useState("");
  const [drafts, setDrafts] = useState<MemoryDraft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const chosen = connections.find((c) => c.id === connectionId);

  const run = async () => {
    setBusy(true); setErr(null);
    try {
      const res: any = await extractFromText({
        data: {
          countryCode,
          text: payload,
          sourceHint: chosen ? `${chosen.title} (${chosen.connection_kind})` : "API/MCP response",
          sectorHint: sectorHint || undefined,
        },
      });
      setDrafts((res.drafts ?? []).map((d: any) => ({
        ...d, _keep: true,
        source_id: chosen?.id ?? null,
        citation_url: chosen?.url ?? null,
      })));
    } catch (e: any) { setErr(e?.message ?? String(e)); }
    finally { setBusy(false); }
  };

  const commit = async () => {
    if (!drafts) return;
    setBusy(true);
    try {
      const items = drafts.filter((d) => d._keep !== false).map(({ _keep, ...rest }) => rest);
      if (items.length) await bulk({ data: { countryCode, items } });
      setDrafts(null); setPayload(""); onDone(); onClose();
    } finally { setBusy(false); }
  };

  if (drafts) {
    return (
      <div className="space-y-3">
        <MemoryDraftReview drafts={drafts} setDrafts={setDrafts} onCommit={commit} busy={busy} sourceHint={chosen?.title ?? "API/MCP"} />
        <button onClick={() => setDrafts(null)} className="text-xs text-ink-500 underline">← Back</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">
        Pick an existing API or MCP connection for provenance, then paste the JSON/text response to mine memories from.
        Register new connections from the Sources tab.
      </p>
      <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)} className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0">
        <option value="">— no connection (freeform paste) —</option>
        {connections.map((c) => (
          <option key={c.id} value={c.id}>{c.connection_kind.toUpperCase()} · {c.title} — {c.org}</option>
        ))}
      </select>
      <textarea
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        rows={10}
        placeholder="Paste API/MCP response payload (JSON or text)…"
        className="w-full border border-line-200 px-2 py-1.5 text-sm font-mono bg-paper-0"
      />
      <input value={sectorHint} onChange={(e) => setSectorHint(e.target.value)} placeholder="Sector hint (optional)" className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        onClick={run}
        disabled={busy || payload.trim().length < 20}
        className="w-full px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50"
      >
        {busy ? "Extracting…" : "Extract memories from response"}
      </button>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? "");
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
