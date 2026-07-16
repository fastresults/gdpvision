import { useMutation } from "@tanstack/react-query";
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
import {
  bulkAddLinks,
  ingestDocumentSource,
  registerConnection,
  upsertSource,
} from "@/lib/country-data/manage.functions";

const KINDS = ["gov", "regional", "multilateral", "advisory", "ngo", "media", "summit"];

type Props = {
  countryCode: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
};

export function AddSourceDialog({ countryCode, open, onClose, onDone }: Props) {
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Add source</DialogTitle>
          <DialogDescription>
            Add links, upload documents, or connect an API / MCP server. Duplicates are collapsed automatically — the same source can never appear twice.
          </DialogDescription>
        </DialogHeader>
        <VisibilityToggle value={visibility} onChange={setVisibility} />
        <Tabs defaultValue="link" className="mt-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="link">Link</TabsTrigger>
            <TabsTrigger value="bulk">Bulk links</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="api">API / MCP</TabsTrigger>
          </TabsList>
          <TabsContent value="link" className="mt-4">
            <SingleLinkTab countryCode={countryCode} visibility={visibility} onDone={() => { onDone(); onClose(); }} />
          </TabsContent>
          <TabsContent value="bulk" className="mt-4">
            <BulkLinksTab countryCode={countryCode} visibility={visibility} onDone={() => { onDone(); onClose(); }} />
          </TabsContent>
          <TabsContent value="documents" className="mt-4">
            <DocumentsTab countryCode={countryCode} visibility={visibility} onDone={() => { onDone(); onClose(); }} />
          </TabsContent>
          <TabsContent value="api" className="mt-4">
            <ApiMcpTab countryCode={countryCode} onDone={() => { onDone(); onClose(); }} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function VisibilityToggle({ value, onChange }: { value: "public" | "private"; onChange: (v: "public" | "private") => void }) {
  return (
    <div className="mt-2 border border-line-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-500">Visibility</p>
          <p className="text-xs text-ink-700 mt-1">
            {value === "private"
              ? "Only your country's admins and team members can see this. Never surfaced on public hooks."
              : "Shared across the platform. Anyone (including anonymous visitors) can read this source."}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onChange("public")}
            className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] border ${value === "public" ? "border-ink-950 bg-ink-950 text-paper-0" : "border-line-200"}`}
          >
            Public
          </button>
          <button
            type="button"
            onClick={() => onChange("private")}
            className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] border ${value === "private" ? "border-ink-950 bg-ink-950 text-paper-0" : "border-line-200"}`}
          >
            Private
          </button>
        </div>
      </div>
    </div>
  );
}

function SingleLinkTab({ countryCode, visibility, onDone }: { countryCode: string; visibility: "public" | "private"; onDone: () => void }) {
  const upsert = useServerFn(upsertSource);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [org, setOrg] = useState("");
  const [kind, setKind] = useState("gov");
  const [q, setQ] = useState(3);
  const mut = useMutation({
    mutationFn: async () =>
      upsert({ data: { countryCode, url, title, org, kind, quality_score: q, active: true, tags: [], visibility } }),
    onSuccess: onDone,
  });
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
      className="space-y-3"
    >
      <input required placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      <div className="grid grid-cols-3 gap-2">
        <input required placeholder="Organization" value={org} onChange={(e) => setOrg(e.target.value)} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0">
          {KINDS.map((k) => <option key={k}>{k}</option>)}
        </select>
        <select value={q} onChange={(e) => setQ(Number(e.target.value))} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0">
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
        </select>
      </div>
      {mut.error && <p className="text-xs text-red-600">{(mut.error as Error).message}</p>}
      <button disabled={mut.isPending} className="w-full px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50">
        {mut.isPending ? "Adding…" : "Add source"}
      </button>
    </form>
  );
}

function BulkLinksTab({ countryCode, onDone }: { countryCode: string; onDone: () => void }) {
  const bulk = useServerFn(bulkAddLinks);
  const [text, setText] = useState("");
  const [kind, setKind] = useState("gov");
  const [result, setResult] = useState<{ added: number; duplicates: number; errors: any[] } | null>(null);
  const mut = useMutation({
    mutationFn: async () => {
      const urls = text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      return bulk({ data: { countryCode, urls, kind, quality_score: 3 } });
    },
    onSuccess: (r) => { setResult(r); onDone(); },
  });
  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">Paste multiple URLs (one per line, or comma-separated). Duplicates are automatically skipped.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={"https://…\nhttps://…"}
        className="w-full border border-line-200 px-2 py-1.5 text-sm font-mono bg-paper-0"
      />
      <div className="flex gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0">
          {KINDS.map((k) => <option key={k}>{k}</option>)}
        </select>
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !text.trim()}
          className="flex-1 px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50"
        >
          {mut.isPending ? "Adding…" : "Add all"}
        </button>
      </div>
      {result && (
        <div className="text-xs">
          Added {result.added} · Duplicates skipped {result.duplicates} · Errors {result.errors.length}
          {result.errors.length > 0 && (
            <ul className="mt-2 text-red-600 space-y-1">
              {result.errors.map((e, i) => <li key={i} className="truncate">{e.url}: {e.error}</li>)}
            </ul>
          )}
        </div>
      )}
      {mut.error && <p className="text-xs text-red-600">{(mut.error as Error).message}</p>}
    </div>
  );
}

function DocumentsTab({ countryCode, onDone }: { countryCode: string; onDone: () => void }) {
  const ingest = useServerFn(ingestDocumentSource);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [org, setOrg] = useState("");
  const [progress, setProgress] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      for (const f of files) {
        setProgress(`Uploading ${f.name}…`);
        const b64 = await fileToBase64(f);
        await ingest({
          data: {
            countryCode,
            filename: f.name,
            mime_type: f.type || "application/octet-stream",
            content_b64: b64,
            title: f.name,
            org: org || "Uploaded document",
          },
        });
      }
      setProgress(null);
    },
    onSuccess: () => { onDone(); setFiles([]); },
    onError: () => setProgress(null),
  });

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const dropped = Array.from(e.dataTransfer.files);
          setFiles((prev) => [...prev, ...dropped].slice(0, 10));
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed p-8 text-center cursor-pointer ${dragOver ? "border-ink-950 bg-paper-100" : "border-line-200"}`}
      >
        <p className="text-sm">Drop files here or click to browse</p>
        <p className="text-xs text-ink-500 mt-1">PDF, DOCX, TXT, MD · up to 10 files, 20MB each</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const chosen = Array.from(e.target.files ?? []);
            setFiles((prev) => [...prev, ...chosen].slice(0, 10));
          }}
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
        placeholder="Organization / publisher (optional)"
        value={org}
        onChange={(e) => setOrg(e.target.value)}
        className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0"
      />
      {progress && <p className="text-xs text-ink-500">{progress}</p>}
      {mut.error && <p className="text-xs text-red-600">{(mut.error as Error).message}</p>}
      <button
        disabled={mut.isPending || files.length === 0}
        onClick={() => mut.mutate()}
        className="w-full px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50"
      >
        {mut.isPending ? "Uploading…" : `Upload ${files.length || ""} file${files.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}

function ApiMcpTab({ countryCode, onDone }: { countryCode: string; onDone: () => void }) {
  const register = useServerFn(registerConnection);
  const [kind, setKind] = useState<"api" | "mcp">("api");
  const [title, setTitle] = useState("");
  const [org, setOrg] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [authHeader, setAuthHeader] = useState("Authorization");
  const [secretRef, setSecretRef] = useState("");
  const mut = useMutation({
    mutationFn: async () =>
      register({
        data: {
          countryCode,
          connection_kind: kind,
          title,
          org,
          endpoint_url: endpoint,
          auth_header_name: authHeader || null,
          secret_ref: secretRef || null,
          config: {},
        },
      }),
    onSuccess: onDone,
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
      <div className="flex gap-2">
        <button type="button" onClick={() => setKind("api")} className={`flex-1 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] border ${kind === "api" ? "border-ink-950 bg-ink-950 text-paper-0" : "border-line-200"}`}>REST API</button>
        <button type="button" onClick={() => setKind("mcp")} className={`flex-1 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.2em] border ${kind === "mcp" ? "border-ink-950 bg-ink-950 text-paper-0" : "border-line-200"}`}>MCP server</button>
      </div>
      <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      <input required placeholder="Organization" value={org} onChange={(e) => setOrg(e.target.value)} className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      <input required placeholder={kind === "mcp" ? "https://…/mcp-server/http" : "https://api.example.com/…"} value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="w-full border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
      {kind === "api" && (
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Auth header (e.g. Authorization)" value={authHeader} onChange={(e) => setAuthHeader(e.target.value)} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
          <input placeholder="Secret name (env var)" value={secretRef} onChange={(e) => setSecretRef(e.target.value)} className="border border-line-200 px-2 py-1.5 text-sm bg-paper-0" />
        </div>
      )}
      <p className="text-xs text-ink-500">
        {kind === "mcp"
          ? "Register the MCP server URL. Approved MCPs are made available to the country's AI agent."
          : "Store the API secret via the workspace Secrets settings, then reference it by name here."}
      </p>
      {mut.error && <p className="text-xs text-red-600">{(mut.error as Error).message}</p>}
      <button disabled={mut.isPending} className="w-full px-3 py-2 text-[11px] font-mono uppercase tracking-[0.2em] border border-ink-950 bg-ink-950 text-paper-0 disabled:opacity-50">
        {mut.isPending ? "Registering…" : `Register ${kind.toUpperCase()} source`}
      </button>
    </form>
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
