import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ScrollText, Upload, Sparkles, Target, FileCheck, Loader2, Wand2, Building2, AlertTriangle, TrendingUp, ExternalLink, ShieldCheck, PenLine, PlayCircle, Flag, Clock, Users, Link2, FileText, X } from "lucide-react";
import { RevisionsPanel } from "@/components/mandate-compact/RevisionsPanel";
import { MinistriesPanel } from "@/components/mandate-compact/MinistriesPanel";

import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { listMandateCompacts, type CompactRow } from "@/lib/mandate-compact/list.functions";
import { ingestManifesto } from "@/lib/mandate-compact/ingest.functions";
import { extractManifesto, type ExtractManifestoResult } from "@/lib/mandate-compact/extract.functions";
import { getMandateCompactDetail, type CompactDetail } from "@/lib/mandate-compact/detail.functions";
import { decomposeMandateCompact } from "@/lib/mandate-compact/decompose.functions";
import { transformMandateCompact } from "@/lib/mandate-compact/transform.functions";
import {
  upsertDeliverableStatus,
  computeScorecards,
  getPmReportCard,
  type PmReportCard,
  type StatusStatus,
} from "@/lib/mandate-compact/track.functions";
import {
  signMandateCompact,
  activateMandateCompact,
  concludeMandateCompact,
} from "@/lib/mandate-compact/publish.functions";
import { cn } from "@/lib/utils";

function compactsQuery(code: string) {
  return queryOptions({
    queryKey: ["mandate-compacts", code],
    queryFn: () => listMandateCompacts({ data: { countryCode: code } }),
  });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/mandate-compact")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(compactsQuery(params.code));
  },
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-rose-600">Failed to load Mandate Compact: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm text-ink-500">Not found.</div>,
  component: MandateCompactPage,
});

const STEPS = [
  { key: "ingest", label: "Ingest", icon: Upload, hint: "Upload the manifesto & seed the second brain" },
  { key: "decompose", label: "Decompose", icon: ScrollText, hint: "AI pillars & pledges" },
  { key: "transform", label: "Transform", icon: Sparkles, hint: "Ministry-owned delivery plan" },
  { key: "track", label: "Track", icon: Target, hint: "Quarterly scorecards" },
  { key: "ministries", label: "Ministries", icon: Users, hint: "Per-ministry drilldown & at-risk digest" },
  { key: "publish", label: "Publish", icon: ShieldCheck, hint: "Sign, activate, conclude" },
  { key: "history", label: "History", icon: Clock, hint: "Audit trail & diffs" },
] as const;

function MandateCompactPage() {
  const { code } = Route.useParams();
  const { data: compacts } = useSuspenseQuery(compactsQuery(code));
  const [activeStep, setActiveStep] = useState<(typeof STEPS)[number]["key"]>("ingest");
  const [selectedCompactId, setSelectedCompactId] = useState<string | null>(compacts[0]?.id ?? null);
  const selectedCompact = useMemo(
    () => compacts.find((c) => c.id === selectedCompactId) ?? compacts[0] ?? null,
    [compacts, selectedCompactId],
  );

  return (
    <SuperAdminShell
      eyebrow="Chamber 08"
      crumbs={[
        { label: "Countries", to: "/admin/countries" },
        { label: code, to: "/admin/countries/$code/onboard", params: { code } },
        { label: "Mandate Compact" },
      ]}
    >
      <div className="mx-auto max-w-6xl space-y-16 px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        <header className="flex items-baseline justify-between gap-6 border-b border-line-200 pb-6">
          <div className="min-w-0 space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
              Chamber 08 · Mandate Compact
            </p>
            <h1 className="font-serif text-3xl font-normal leading-tight text-ink-950 sm:text-4xl">
              Mandate Compact · <span className="text-ink-700">{code}</span>
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-ink-500">
              The covenant that turns the ruling party's manifesto into a signed, ministry-by-ministry delivery plan.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Status</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-950">
              {selectedCompact ? selectedCompact.status.replace("_", " ") : "Draft mode"}
            </p>
          </div>
        </header>

        {compacts.length > 0 && (
          <ElectionsIndex
            compacts={compacts}
            selectedId={selectedCompact?.id ?? null}
            onSelect={(id) => setSelectedCompactId(id)}
            onNew={() => {
              setSelectedCompactId(null);
              setActiveStep("ingest");
            }}
          />
        )}

        <Stepper active={activeStep} onSelect={setActiveStep} />

        {activeStep === "ingest" && (
          <IngestPanel
            countryCode={code}
            compacts={compacts}
            editingCompact={selectedCompact}
          />
        )}
        {activeStep === "decompose" && (
          selectedCompact
            ? <DecomposePanel countryCode={code} compact={selectedCompact} />
            : <EmptyState body="Ingest a manifesto first, then return here to decompose it." />
        )}
        {activeStep === "transform" && (
          selectedCompact
            ? <TransformPanel countryCode={code} compact={selectedCompact} />
            : <EmptyState body="Ingest and decompose a manifesto first." />
        )}
        {activeStep === "track" && (
          selectedCompact
            ? <TrackPanel countryCode={code} compact={selectedCompact} />
            : <EmptyState body="Ingest, decompose, and transform a manifesto first." />
        )}
        {activeStep === "ministries" && (
          selectedCompact
            ? <MinistriesPanel compactId={selectedCompact.id} />
            : <EmptyState body="Ingest, decompose, and transform a manifesto first — the ministry drilldown lights up once deliverables have owners." />
        )}
        {activeStep === "publish" && (
          selectedCompact
            ? <PublishPanel countryCode={code} compact={selectedCompact} />
            : <EmptyState body="Ingest a manifesto first." />
        )}
        {activeStep === "history" && (
          selectedCompact
            ? <RevisionsPanel compactId={selectedCompact.id} />
            : <EmptyState body="Ingest a manifesto first — the audit trail begins with the first snapshot." />
        )}
      </div>


    </SuperAdminShell>
  );
}

function Stepper({ active, onSelect }: { active: string; onSelect: (k: (typeof STEPS)[number]["key"]) => void }) {
  return (
    <nav aria-label="Mandate Compact workflow">
      <ol className="grid grid-cols-4 gap-x-3 gap-y-6 md:grid-cols-7 md:gap-x-4">
        {STEPS.map((step, idx) => {
          const isActive = active === step.key;
          const num = String(idx + 1).padStart(2, "0");
          return (
            <li key={step.key}>
              <button
                type="button"
                onClick={() => onSelect(step.key)}
                aria-current={isActive ? "step" : undefined}
                className="group flex w-full flex-col items-start text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500"
              >
                <span
                  className={cn(
                    "font-mono text-[10px] tracking-[0.18em] transition-colors",
                    isActive ? "font-medium text-gold-500" : "text-ink-400 group-hover:text-ink-700",
                  )}
                >
                  {num}
                </span>
                <span
                  className={cn(
                    "mt-2 h-[2px] w-full transition-colors",
                    isActive ? "bg-gold-500" : "bg-line-200 group-hover:bg-ink-300",
                  )}
                />
                <span
                  className={cn(
                    "mt-2.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
                    isActive ? "font-semibold text-ink-950" : "text-ink-500 group-hover:text-ink-900",
                  )}
                >
                  {step.label}
                </span>
                <span className="mt-1 hidden text-[11px] leading-snug text-ink-400 md:block">
                  {step.hint}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}


type ExtractedForm = {
  electionCycle: string;
  title: string;
  pmName: string;
  governingParty: string;
  summary: string;
  sourceUrl: string;
  pillars: string[];
  matchedPartyId: string | null;
  matchedPartyName: string | null;
  rawText: string;
  charCount: number;
  textSource: "file" | "url" | "pasted";
  fromAI: boolean;
};

const EMPTY_FORM: ExtractedForm = {
  electionCycle: "",
  title: "",
  pmName: "",
  governingParty: "",
  summary: "",
  sourceUrl: "",
  pillars: [],
  matchedPartyId: null,
  matchedPartyName: null,
  rawText: "",
  charCount: 0,
  textSource: "pasted",
  fromAI: false,
};

function IngestPanel({ countryCode, compacts, editingCompact }: { countryCode: string; compacts: CompactRow[]; editingCompact?: CompactRow | null }) {
  const qc = useQueryClient();
  const ingest = useServerFn(ingestManifesto);
  const extract = useServerFn(extractManifesto);

  const [form, setForm] = useState<ExtractedForm>(EMPTY_FORM);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [phase, setPhase] = useState<"idle" | "extracting" | "ready" | "error">("idle");
  const [phaseMsg, setPhaseMsg] = useState<string>("");
  const [pastedUrl, setPastedUrl] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dirtyFields, setDirtyFields] = useState<Set<keyof ExtractedForm>>(new Set());

  const markDirty = (k: keyof ExtractedForm) =>
    setDirtyFields((prev) => (prev.has(k) ? prev : new Set(prev).add(k)));

  const applyExtracted = (res: ExtractManifestoResult) => {
    setForm({
      electionCycle: res.extracted.election_cycle || "",
      title: res.extracted.title || "",
      pmName: res.extracted.pm_name || "",
      governingParty: res.extracted.governing_party || "",
      summary: res.extracted.summary || "",
      sourceUrl: res.sourceUrl || "",
      pillars: res.extracted.pillars_preview || [],
      matchedPartyId: res.matchedPartyId,
      matchedPartyName: res.matchedPartyName,
      rawText: res.rawText,
      charCount: res.charCount,
      textSource: res.textSource,
      fromAI: true,
    });
    setDirtyFields(new Set());
    setPhase("ready");
    setPhaseMsg(
      `AI read ${res.charCount.toLocaleString()} chars from ${res.textSource} · ${res.extracted.pillars_preview.length} pillars detected`,
    );
  };

  const runExtract = async (payload: {
    countryCode: string;
    fileBase64?: string;
    mimeType?: string;
    filename?: string;
    sourceUrl?: string;
    pastedText?: string;
  }) => {
    setPhase("extracting");
    setPhaseMsg("Reading manifesto…");
    try {
      const res = await extract({ data: payload });
      applyExtracted(res);
      toast.success("Manifesto read — review the auto-filled fields below.");
    } catch (err) {
      setPhase("error");
      const msg = (err as Error).message;
      setPhaseMsg(msg);
      setManualOpen(true);
      toast.error(msg);
    }
  };

  const handleFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large (max 20 MB).");
      return;
    }
    const buf = await file.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const b64 = btoa(bin);
    await runExtract({
      countryCode,
      fileBase64: b64,
      mimeType: file.type || undefined,
      filename: file.name,
    });
  };

  const handleUrl = async () => {
    const url = pastedUrl.trim();
    if (!url) return;
    await runExtract({ countryCode, sourceUrl: url });
  };

  const reset = () => {
    setForm(EMPTY_FORM);
    setPhase("idle");
    setPhaseMsg("");
    setPastedUrl("");
    setManualOpen(false);
    setDirtyFields(new Set());
  };

  const mutation = useMutation({
    mutationFn: () =>
      ingest({
        data: {
          countryCode,
          electionCycle: form.electionCycle.trim(),
          title: form.title.trim() || undefined,
          pmName: form.pmName.trim() || undefined,
          governingPartyId: form.matchedPartyId ?? undefined,
          sourceUrl: form.sourceUrl.trim() || undefined,
          sourceText: form.rawText.trim() || undefined,
          summary: form.summary.trim() || undefined,
          visibility,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.existed
          ? `Compact updated · ${res.chunks_indexed} chunks indexed`
          : `Compact created · ${res.chunks_indexed} chunks indexed`,
      );
      qc.invalidateQueries({ queryKey: ["mandate-compacts", countryCode] });
      reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canCreate =
    !mutation.isPending &&
    form.electionCycle.trim().length > 0 &&
    (form.sourceUrl.trim().length > 0 || form.rawText.trim().length > 0);

  const underline =
    "w-full appearance-none border-0 border-b border-line-200 bg-transparent px-0 py-2 text-sm text-ink-950 placeholder:text-ink-300 focus:border-gold-500 focus:outline-none focus:ring-0";

  return (
    <section className="grid gap-12 border-b border-line-200 pb-12 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">Step 01</p>
        <h2 className="mt-2 font-serif text-2xl font-normal leading-tight text-ink-950">
          Drop the manifesto
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-ink-500">
          Drop a PDF, DOCX, or TXT — or paste a URL. AI reads it end-to-end and
          fills in the election cycle, title, PM, party, summary, and top
          pillars. You only review and sign off.
        </p>
        {compacts.length > 0 && (
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
            {compacts.length} compact{compacts.length === 1 ? "" : "s"} on file · {countryCode}
          </p>
        )}
      </div>

      <div className="space-y-10 lg:col-span-8">
        {/* ─── Drop zone ─────────────────────────────────────────────── */}
        <DropZone
          phase={phase}
          phaseMsg={phaseMsg}
          dragOver={dragOver}
          onDragState={setDragOver}
          onFile={handleFile}
          onReset={reset}
        />


        {/* URL alternative */}
        {phase !== "ready" && (
          <div className="mt-4 flex items-center gap-3 border-b border-line-200 pb-2">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-ink-400" />
            <input
              type="url"
              value={pastedUrl}
              onChange={(e) => setPastedUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleUrl();
                }
              }}
              placeholder="…or paste a manifesto URL and press Enter"
              disabled={phase === "extracting"}
              className="w-full appearance-none border-0 bg-transparent p-0 py-1 text-sm text-ink-950 placeholder:text-ink-300 focus:outline-none focus:ring-0"
            />
            <button
              type="button"
              onClick={() => void handleUrl()}
              disabled={phase === "extracting" || !pastedUrl.trim()}
              className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-gold-500 disabled:cursor-not-allowed disabled:text-ink-300"
            >
              Read →
            </button>
          </div>
        )}


        {/* ─── Auto-filled preview (visible after extraction) ────────── */}
        {phase === "ready" && (
          <div className="space-y-8">
            {form.pillars.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
                  AI read · {form.pillars.length} pillars detected
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {form.pillars.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center border border-line-200 bg-paper-50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-700"
                    >
                      {p}
                    </span>
                  ))}
                </div>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
                  Will be committed in Step 02 · Decompose
                </p>
              </div>
            )}

            <AutoField
              label="Election cycle"
              required
              ai={form.fromAI && !dirtyFields.has("electionCycle")}
            >
              <input
                className={underline}
                placeholder="e.g. 2025-2030"
                value={form.electionCycle}
                onChange={(e) => {
                  markDirty("electionCycle");
                  setForm((f) => ({ ...f, electionCycle: e.target.value }));
                }}
              />
            </AutoField>

            <div className="grid gap-8 md:grid-cols-2">
              <AutoField label="Compact title" ai={form.fromAI && !dirtyFields.has("title")}>
                <input
                  className={underline}
                  value={form.title}
                  onChange={(e) => {
                    markDirty("title");
                    setForm((f) => ({ ...f, title: e.target.value }));
                  }}
                  placeholder={`${form.electionCycle || "2025-2030"} Mandate Compact`}
                />
              </AutoField>
              <AutoField label="Prime Minister" ai={form.fromAI && !dirtyFields.has("pmName")}>
                <input
                  className={underline}
                  value={form.pmName}
                  onChange={(e) => {
                    markDirty("pmName");
                    setForm((f) => ({ ...f, pmName: e.target.value }));
                  }}
                  placeholder="Rt. Hon. —"
                />
              </AutoField>
            </div>

            <AutoField
              label="Governing party"
              ai={form.fromAI && !dirtyFields.has("governingParty")}
              aside={
                form.matchedPartyName ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-500">
                    ✓ matched · {form.matchedPartyName}
                  </span>
                ) : form.governingParty ? (
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal-warning">
                    ⚠ no match in country_parties
                  </span>
                ) : null
              }
            >
              <input
                className={underline}
                value={form.governingParty}
                onChange={(e) => {
                  markDirty("governingParty");
                  setForm((f) => ({ ...f, governingParty: e.target.value, matchedPartyId: null, matchedPartyName: null }));
                }}
              />
            </AutoField>

            <AutoField label="Manifesto source URL" ai={form.fromAI && !dirtyFields.has("sourceUrl") && form.textSource === "url"}>
              <input
                className={underline}
                placeholder="https://…"
                value={form.sourceUrl}
                onChange={(e) => {
                  markDirty("sourceUrl");
                  setForm((f) => ({ ...f, sourceUrl: e.target.value }));
                }}
              />
            </AutoField>

            <AutoField label="Executive summary" ai={form.fromAI && !dirtyFields.has("summary")}>
              <textarea
                className={cn(underline, "min-h-[88px] resize-y leading-relaxed")}
                value={form.summary}
                onChange={(e) => {
                  markDirty("summary");
                  setForm((f) => ({ ...f, summary: e.target.value }));
                }}
              />
            </AutoField>

            <AutoField
              label="Visibility"
            >
              <select
                className={underline}
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as "public" | "private")}
              >
                <option value="public">Public — visible to all country users & Promise Tracker once signed</option>
                <option value="private">Private — owner country only</option>
              </select>
            </AutoField>

            <details className="border-t border-line-200 pt-4">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500 hover:text-ink-950">
                <FileText className="mr-2 inline h-3 w-3" />
                Full text · {form.charCount.toLocaleString()} chars · chunk-embedded on Create
              </summary>
              <textarea
                className={cn(
                  "mt-3 w-full resize-y border border-line-200 bg-paper-50 p-4 font-mono text-xs leading-relaxed text-ink-950",
                  "min-h-[200px] focus:border-gold-500 focus:outline-none focus:ring-0",
                )}
                value={form.rawText}
                onChange={(e) => {
                  markDirty("rawText");
                  setForm((f) => ({ ...f, rawText: e.target.value, charCount: e.target.value.length }));
                }}
              />
            </details>

            <div className="flex items-center justify-end gap-6 border-t border-line-200 pt-6">
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={!canCreate}
                className={cn(
                  "inline-flex items-center gap-2 bg-ink-950 px-8 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 transition-colors",
                  "hover:bg-gold-500 hover:text-ink-950",
                  "disabled:cursor-not-allowed disabled:bg-ink-300 disabled:text-paper-0 disabled:hover:bg-ink-300",
                )}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating
                  </>
                ) : (
                  <>
                    <FileCheck className="h-3.5 w-3.5" /> Create Compact
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ─── Manual fallback (shown on extraction error) ───────────── */}
        {phase !== "ready" && (
          <details
            open={manualOpen}
            onToggle={(e) => setManualOpen((e.target as HTMLDetailsElement).open)}
            className="border-t border-line-200 pt-4"
          >
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500 hover:text-ink-950">
              <PenLine className="mr-2 inline h-3 w-3" />
              Enter fields manually instead
            </summary>
            <div className="mt-6 space-y-6">
              <AutoField label="Election cycle" required>
                <input
                  className={underline}
                  placeholder="e.g. 2025-2030"
                  value={form.electionCycle}
                  onChange={(e) => setForm((f) => ({ ...f, electionCycle: e.target.value }))}
                />
              </AutoField>
              <AutoField label="Manifesto full text or URL">
                <textarea
                  className={cn(
                    "w-full resize-y border border-line-200 bg-paper-50 p-4 font-mono text-xs leading-relaxed text-ink-950 min-h-[200px]",
                    "focus:border-gold-500 focus:outline-none focus:ring-0",
                  )}
                  value={form.rawText}
                  onChange={(e) => setForm((f) => ({ ...f, rawText: e.target.value, charCount: e.target.value.length }))}
                  placeholder="Paste the manifesto text here (min 200 chars)."
                />
              </AutoField>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => mutation.mutate()}
                  disabled={!canCreate}
                  className={cn(
                    "inline-flex items-center gap-2 bg-ink-950 px-8 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-paper-0 transition-colors",
                    "hover:bg-gold-500 hover:text-ink-950 disabled:cursor-not-allowed disabled:bg-ink-300",
                  )}
                >
                  <FileCheck className="h-3.5 w-3.5" /> Create Compact
                </button>
              </div>
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

function DropZone({
  phase,
  phaseMsg,
  dragOver,
  onDragState,
  onFile,
  onReset,
}: {
  phase: "idle" | "extracting" | "ready" | "error";
  phaseMsg: string;
  dragOver: boolean;
  onDragState: (v: boolean) => void;
  onFile: (f: File) => void;
  onReset: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const disabled = phase === "extracting";

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop manifesto file here or click to browse"
        data-testid="mandate-drop"
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) onDragState(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
          if (!disabled && !dragOver) onDragState(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDragState(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDragState(false);
          if (disabled) return;
          const dt = e.dataTransfer;
          let file: File | null = null;
          if (dt?.items && dt.items.length) {
            for (let i = 0; i < dt.items.length; i++) {
              const it = dt.items[i];
              if (it.kind === "file") {
                const f = it.getAsFile();
                if (f) { file = f; break; }
              }
            }
          }
          if (!file && dt?.files && dt.files.length) {
            file = dt.files[0];
          }
          // eslint-disable-next-line no-console
          console.debug("[mandate-compact] drop", { hasFile: !!file, name: file?.name, type: file?.type, size: file?.size });
          if (!file) {
            toast.error("No file detected in the drop. Try clicking the zone to browse instead.");
            return;
          }
          if (file.size === 0) {
            toast.error("That looks like a folder or an empty file — drop a single PDF, DOCX, or TXT.");
            return;
          }
          onFile(file);
        }}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-16 text-center transition-colors focus:outline-none focus-visible:border-gold-500",
          dragOver
            ? "border-gold-500 bg-gold-500/5"
            : phase === "ready"
              ? "border-line-200 bg-paper-50"
              : phase === "error"
                ? "border-signal-critical/40 bg-signal-critical/5"
                : "border-line-200 bg-paper-50 hover:border-ink-300 hover:bg-paper-0",
        )}
      >
        {phase === "extracting" ? (
          <>
            <Loader2 className="h-7 w-7 animate-spin text-gold-500" />
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink-950">
              {phaseMsg || "Reading…"}
            </p>
            <p className="text-xs text-ink-500">This usually takes 10-30 seconds.</p>
          </>
        ) : phase === "ready" ? (
          <>
            <FileCheck className="h-7 w-7 text-gold-500" />
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink-950">
              Manifesto read
            </p>
            <p className="max-w-lg text-xs text-ink-500">{phaseMsg}</p>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReset();
              }}
              className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-gold-500"
            >
              <X className="h-3 w-3" /> Drop another
            </button>
          </>
        ) : (
          <>
            <Upload className="h-7 w-7 text-ink-500 group-hover:text-gold-500" />
            <p className="font-serif text-lg text-ink-950">Drop the manifesto here</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              PDF · DOCX · TXT · max 20 MB · or click to browse
            </p>
            {phase === "error" && (
              <p className="mt-2 max-w-lg text-xs text-signal-critical">{phaseMsg}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AutoField({
  label,
  required,
  ai,
  aside,
  children,
}: {
  label: string;
  required?: boolean;
  ai?: boolean;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-4">
        <span className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-500">
            {label}
            {required && <span className="ml-1 text-gold-500">*</span>}
          </span>
          {ai && (
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gold-500">
              AI
            </span>
          )}
        </span>
        {aside}
      </span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}



function CompactList({ compacts }: { compacts: CompactRow[] }) {
  if (!compacts.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line-200 bg-paper-50 p-6 text-center text-sm text-ink-500">
        No Mandate Compacts yet. Start by ingesting the current government's manifesto above.
      </div>
    );
  }
  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Compacts on file</h2>
      <ul className="grid gap-3">
        {compacts.map((c) => (
          <li key={c.id} className="rounded-2xl border border-line-200 bg-paper-0 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-ink-900">{c.title ?? `${c.election_cycle} Compact`}</h3>
                <p className="mt-1 text-xs text-ink-500">
                  {c.pm_name ? `PM ${c.pm_name} · ` : ""}
                  {c.election_cycle} · {c.visibility}
                </p>
              </div>
              <StatusPill status={c.status} />
            </div>
            {c.summary && <p className="mt-2 text-sm text-ink-700">{c.summary}</p>}
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-ink-500">
              <Stat label="Pillars" value={c.pillar_count} />
              <Stat label="Pledges" value={c.pledge_count} />
              <Stat label="Deliverables" value={c.deliverable_count} />
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PhasePlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-dashed border-line-200 bg-paper-50 p-6">
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      <p className="mt-1 text-sm text-ink-500">{body}</p>
    </section>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("grid gap-1", className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-paper-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-ink-900">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    draft: "bg-paper-100 text-ink-700",
    signed: "bg-gold-500/20 text-ink-950",
    in_force: "bg-signal-lead/20 text-ink-900",
    concluded: "bg-ink-300 text-ink-50",
    superseded: "bg-ink-300 text-ink-50",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide", tone[status] ?? "bg-paper-100 text-ink-700")}>
      {status.replace("_", " ")}
    </span>
  );
}

function EmptyState({ body }: { body: string }) {
  return (
    <section className="rounded-2xl border border-dashed border-line-200 bg-paper-50 p-6 text-sm text-ink-500">
      {body}
    </section>
  );
}

function CompactSelector({
  compacts,
  selectedId,
  onSelect,
}: {
  compacts: CompactRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <label className="flex flex-wrap items-center gap-3 rounded-2xl border border-line-200 bg-paper-0 p-3 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-500">Working on</span>
      <select
        className="input flex-1"
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        {compacts.map((c) => (
          <option key={c.id} value={c.id}>
            {(c.title ?? `${c.election_cycle} Compact`) + ` · ${c.status}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function detailQuery(compactId: string) {
  return queryOptions({
    queryKey: ["mandate-compact-detail", compactId],
    queryFn: () => getMandateCompactDetail({ data: { compactId } }),
  });
}

function DecomposePanel({ countryCode, compact }: { countryCode: string; compact: CompactRow }) {
  const qc = useQueryClient();
  const detail = useQuery(detailQuery(compact.id));
  const decompose = useServerFn(decomposeMandateCompact);
  const mutation = useMutation({
    mutationFn: () => decompose({ data: { compactId: compact.id } }),
    onSuccess: (r) => {
      toast.success(`Decomposed · ${r.pillars_created} pillars · ${r.pledges_created} pledges (${r.model})`);
      qc.invalidateQueries({ queryKey: ["mandate-compact-detail", compact.id] });
      qc.invalidateQueries({ queryKey: ["mandate-compacts", countryCode] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const d = detail.data;

  return (
    <section className="grid gap-4 rounded-2xl border border-line-200 bg-paper-0 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Decompose manifesto</h2>
          <p className="mt-1 text-sm text-ink-500">
            AI reads the ingested manifesto text from the second brain and derives 4-8 transformational pillars, each with 3-10 concrete pledges. Idempotent — running again rebuilds the tree.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Decomposing…</>
          ) : (
            <><Wand2 className="h-4 w-4" /> {d?.pillars.length ? "Re-run decompose" : "Run decompose"}</>
          )}
        </button>
      </header>

      {detail.isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {d && d.pillars.length === 0 && (
        <EmptyState body="No pillars yet. Run decompose to derive them from the manifesto." />
      )}
      {d && d.pillars.length > 0 && <PillarTree detail={d} />}
    </section>
  );
}

function TransformPanel({ countryCode, compact }: { countryCode: string; compact: CompactRow }) {
  const qc = useQueryClient();
  const detail = useQuery(detailQuery(compact.id));
  const transform = useServerFn(transformMandateCompact);
  const mutation = useMutation({
    mutationFn: () => transform({ data: { compactId: compact.id } }),
    onSuccess: (r) => {
      toast.success(
        `Transformed · ${r.deliverables_created} deliverables (${r.unassigned} unassigned) · ${r.model}`,
      );
      qc.invalidateQueries({ queryKey: ["mandate-compact-detail", compact.id] });
      qc.invalidateQueries({ queryKey: ["mandate-compacts", countryCode] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const d = detail.data;
  const pledgeCount = d?.pillars.reduce((s, p) => s + p.pledges.length, 0) ?? 0;
  const delivCount =
    d?.pillars.reduce((s, p) => s + p.pledges.reduce((ss, pl) => ss + pl.deliverables.length, 0), 0) ?? 0;

  return (
    <section className="grid gap-4 rounded-2xl border border-line-200 bg-paper-0 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Transform into a delivery plan</h2>
          <p className="mt-1 text-sm text-ink-500">
            Assign each pledge to a lead ministry with a McKinsey-grade theory of change, quarterly milestones, and a risk read. Idempotent per compact.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={mutation.isPending || pledgeCount === 0}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Transforming…</>
          ) : (
            <><Sparkles className="h-4 w-4" /> {delivCount ? "Re-run transform" : "Run transform"}</>
          )}
        </button>
      </header>

      {pledgeCount === 0 && (
        <EmptyState body="No pledges to transform. Run Decompose first." />
      )}
      {d && delivCount > 0 && <DeliverablesByMinistry detail={d} />}
    </section>
  );
}

function PillarTree({ detail }: { detail: CompactDetail }) {
  return (
    <ol className="grid gap-3">
      {detail.pillars.map((p) => (
        <li key={p.id} className="rounded-xl border border-line-100 bg-paper-50 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink-900">{p.title}</h3>
            <span className="text-[10px] uppercase tracking-wide text-ink-400">
              {p.pledges.length} pledge{p.pledges.length === 1 ? "" : "s"}
            </span>
          </div>
          {p.narrative && <p className="mt-1 text-xs text-ink-500">{p.narrative}</p>}
          <ul className="mt-3 grid gap-2">
            {p.pledges.map((pl) => (
              <li key={pl.id} className="rounded-lg bg-paper-0 p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-ink-900">{pl.title}</span>
                  {pl.pledge_type && (
                    <span className="text-[10px] uppercase tracking-wide text-ink-400">{pl.pledge_type}</span>
                  )}
                </div>
                {pl.verbatim_quote && (
                  <blockquote className="mt-1 border-l-2 border-line-200 pl-2 text-xs italic text-ink-500">
                    “{pl.verbatim_quote}”
                  </blockquote>
                )}
                {(pl.baseline_value != null || pl.target_value != null) && (
                  <p className="mt-1 text-xs text-ink-500 tabular-nums">
                    {pl.baseline_value ?? "—"} → {pl.target_value ?? "—"} {pl.unit ?? ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function DeliverablesByMinistry({ detail }: { detail: CompactDetail }) {
  type Deliverable = CompactDetail["pillars"][number]["pledges"][number]["deliverables"][number];
  const buckets = new Map<string, { ministry: string; items: { pledgeTitle: string; d: Deliverable }[] }>();
  for (const pi of detail.pillars) {
    for (const pl of pi.pledges) {
      for (const d of pl.deliverables) {
        const key = d.lead_ministry_id ?? "unassigned";
        const label = d.lead_ministry_name ?? "Unassigned";
        const bucket = buckets.get(key) ?? { ministry: label, items: [] };
        bucket.items.push({ pledgeTitle: pl.title, d });
        buckets.set(key, bucket);
      }
    }
  }
  const rows = [...buckets.values()].sort((a, b) => (a.ministry === "Unassigned" ? 1 : a.ministry.localeCompare(b.ministry)));

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <details key={row.ministry} className="rounded-xl border border-line-100 bg-paper-50 p-4" open>
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm font-semibold text-ink-900">
            <span className="flex items-center gap-2">
              {row.ministry === "Unassigned" ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <Building2 className="h-4 w-4 text-ink-500" />
              )}
              {row.ministry}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-ink-400">
              {row.items.length} deliverable{row.items.length === 1 ? "" : "s"}
            </span>
          </summary>
          <ul className="mt-3 grid gap-2">
            {row.items.map(({ pledgeTitle, d }) => (
              <li key={d.id} className="rounded-lg bg-paper-0 p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-ink-900">{d.title}</span>
                  {d.risk_level && <RiskPill level={d.risk_level} />}
                </div>
                <p className="mt-1 text-xs text-ink-500">Pledge: {pledgeTitle}</p>
                {d.theory_of_change && <p className="mt-2 text-xs text-ink-700">{d.theory_of_change}</p>}
                {d.quarterly_milestones.length > 0 && (
                  <ol className="mt-2 grid gap-1 text-xs text-ink-600">
                    {d.quarterly_milestones.map((m, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="w-20 shrink-0 font-medium tabular-nums text-ink-500">{m.quarter}</span>
                        <span>{m.target}{m.kpi ? ` · KPI: ${m.kpi}` : ""}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {d.transformational_note && (
                  <p className="mt-2 rounded-md bg-gold-500/10 px-2 py-1 text-[11px] italic text-ink-700">
                    {d.transformational_note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function RiskPill({ level }: { level: string }) {
  const tone: Record<string, string> = {
    low: "bg-signal-lead/20 text-ink-900",
    medium: "bg-gold-500/20 text-ink-950",
    high: "bg-amber-500/25 text-ink-950",
    critical: "bg-rose-500/25 text-ink-950",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", tone[level] ?? "bg-paper-100 text-ink-700")}>
      {level}
    </span>
  );
}

// ────────────────────────── Slice C · Track ──────────────────────────

function currentQuarter(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

function reportCardQuery(compactId: string) {
  return queryOptions({
    queryKey: ["mandate-compact-report-card", compactId],
    queryFn: () => getPmReportCard({ data: { compactId } }),
  });
}

function TrackPanel({ countryCode, compact }: { countryCode: string; compact: CompactRow }) {
  const qc = useQueryClient();
  const detail = useQuery(detailQuery(compact.id));
  const report = useQuery(reportCardQuery(compact.id));
  const compute = useServerFn(computeScorecards);
  const [period, setPeriod] = useState<string>(currentQuarter());

  const computeMut = useMutation({
    mutationFn: () => compute({ data: { compactId: compact.id, period } }),
    onSuccess: (r) => {
      toast.success(`Scorecards computed for ${r.period} · ${r.ministries_scored} ministries`);
      qc.invalidateQueries({ queryKey: ["mandate-compact-report-card", compact.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const delivCount =
    detail.data?.pillars.reduce(
      (s, p) => s + p.pledges.reduce((ss, pl) => ss + pl.deliverables.length, 0),
      0,
    ) ?? 0;

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 rounded-2xl border border-line-200 bg-paper-0 p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink-900">PM Report Card</h2>
            <p className="mt-1 text-sm text-ink-500">
              Live delivery scoreboard per ministry for the selected quarter, computed from status updates below.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input h-9 w-28"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="2025-Q2"
            />
            <button
              type="button"
              className="btn-primary"
              disabled={computeMut.isPending || delivCount === 0}
              onClick={() => computeMut.mutate()}
            >
              {computeMut.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Computing…</>
              ) : (
                <><TrendingUp className="h-4 w-4" /> Recompute</>
              )}
            </button>
          </div>
        </header>

        {report.isLoading && <p className="text-sm text-ink-500">Loading report card…</p>}
        {report.data && <ReportCardSummary report={report.data} />}
        {report.data && report.data.ministries.length === 0 && (
          <EmptyState body={`No scorecards yet for ${period}. Record status updates below, then click Recompute.`} />
        )}
      </section>

      {detail.data && (
        <StatusUpdateBoard
          countryCode={countryCode}
          compact={compact}
          detail={detail.data}
          period={period}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["mandate-compact-report-card", compact.id] });
          }}
        />
      )}
    </div>
  );
}

function ReportCardSummary({ report }: { report: PmReportCard }) {
  const t = report.totals;
  const pct = (n: number) => `${n.toFixed(1)}%`;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <BigStat label="Deliverables" value={`${t.deliverables_reported}/${t.deliverables_total}`} sub="reported / total" tone="ink" />
        <BigStat label="Weighted" value={pct(t.weighted_progress)} sub="progress score" tone="gold" />
        <BigStat label="Delivered" value={pct(t.delivered_pct)} tone="green" />
        <BigStat label="On track" value={pct(t.on_track_pct)} tone="lead" />
        <BigStat label="At risk" value={pct(t.at_risk_pct)} tone="amber" />
        <BigStat label="Off / broken" value={pct(t.off_track_pct + t.broken_pct)} tone="rose" />
      </div>

      {report.ministries.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-line-100">
          <table className="w-full text-sm">
            <thead className="bg-paper-50 text-[10px] uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3 py-2 text-left">Ministry</th>
                <th className="px-3 py-2 text-right">Reported</th>
                <th className="px-3 py-2 text-right">Delivered</th>
                <th className="px-3 py-2 text-right">On track</th>
                <th className="px-3 py-2 text-right">At risk</th>
                <th className="px-3 py-2 text-right">Off / broken</th>
                <th className="px-3 py-2 text-right">Weighted</th>
                <th className="px-3 py-2">Delivery bar</th>
              </tr>
            </thead>
            <tbody>
              {report.ministries.map((m) => (
                <tr key={m.id} className="border-t border-line-100">
                  <td className="px-3 py-2 font-medium text-ink-900">{m.ministry_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-700">{m.deliverables_reported}/{m.deliverables_total}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.delivered_pct.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.on_track_pct.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.at_risk_pct.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{(m.off_track_pct + m.broken_pct).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink-900">{m.weighted_progress.toFixed(1)}%</td>
                  <td className="px-3 py-2 min-w-[160px]"><StackBar m={m} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report.recent_updates.length > 0 && (
        <details className="rounded-xl border border-line-100 bg-paper-50 p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-500">
            Recent status updates ({report.recent_updates.length})
          </summary>
          <ul className="mt-2 grid gap-1 text-xs">
            {report.recent_updates.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-2 rounded bg-paper-0 px-2 py-1">
                <StatusPillCompact status={u.status} />
                <span className="text-ink-500 tabular-nums">{u.period}</span>
                <span className="text-ink-400">·</span>
                <span className="text-ink-700 truncate">{u.narrative ?? "—"}</span>
                {u.evidence_url && (
                  <a href={u.evidence_url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-ink-500 hover:text-ink-900">
                    evidence <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function StackBar({ m }: { m: PmReportCard["ministries"][number] }) {
  const segs = [
    { pct: m.delivered_pct, cls: "bg-signal-lead" },
    { pct: m.on_track_pct, cls: "bg-signal-lead/60" },
    { pct: m.at_risk_pct, cls: "bg-gold-500" },
    { pct: m.off_track_pct, cls: "bg-amber-500" },
    { pct: m.broken_pct, cls: "bg-rose-500" },
  ];
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-paper-100">
      {segs.map((s, i) => s.pct > 0 && <div key={i} className={s.cls} style={{ width: `${s.pct}%` }} />)}
    </div>
  );
}

function BigStat({ label, value, sub, tone = "ink" }: { label: string; value: string; sub?: string; tone?: "ink" | "gold" | "green" | "lead" | "amber" | "rose" }) {
  const toneCls: Record<string, string> = {
    ink: "text-ink-900",
    gold: "text-ink-950",
    green: "text-ink-900",
    lead: "text-ink-900",
    amber: "text-ink-950",
    rose: "text-ink-950",
  };
  const bgCls: Record<string, string> = {
    ink: "bg-paper-50",
    gold: "bg-gold-500/15",
    green: "bg-signal-lead/20",
    lead: "bg-signal-lead/15",
    amber: "bg-amber-500/15",
    rose: "bg-rose-500/15",
  };
  return (
    <div className={cn("rounded-xl px-3 py-2", bgCls[tone])}>
      <div className="text-[10px] uppercase tracking-wide text-ink-500">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold tabular-nums", toneCls[tone])}>{value}</div>
      {sub && <div className="text-[10px] text-ink-400">{sub}</div>}
    </div>
  );
}

function StatusPillCompact({ status }: { status: StatusStatus }) {
  const tone: Record<StatusStatus, string> = {
    delivered: "bg-signal-lead/25 text-ink-900",
    on_track: "bg-signal-lead/15 text-ink-900",
    at_risk: "bg-gold-500/25 text-ink-950",
    off_track: "bg-amber-500/25 text-ink-950",
    broken: "bg-rose-500/25 text-ink-950",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", tone[status])}>
      {status.replace("_", " ")}
    </span>
  );
}

function StatusUpdateBoard({
  compact,
  detail,
  period,
  onSaved,
}: {
  countryCode: string;
  compact: CompactRow;
  detail: CompactDetail;
  period: string;
  onSaved: () => void;
}) {
  const flat = useMemo(() => {
    const out: { pillar: string; pledge: string; ministry: string | null; deliverable_id: string; deliverable_title: string }[] = [];
    for (const pi of detail.pillars) {
      for (const pl of pi.pledges) {
        for (const d of pl.deliverables) {
          out.push({
            pillar: pi.title,
            pledge: pl.title,
            ministry: d.lead_ministry_name,
            deliverable_id: d.id,
            deliverable_title: d.title,
          });
        }
      }
    }
    return out;
  }, [detail]);

  if (flat.length === 0) {
    return (
      <EmptyState body="No deliverables yet. Run Transform first, then return to Track to record status." />
    );
  }

  return (
    <section className="grid gap-3 rounded-2xl border border-line-200 bg-paper-0 p-5">
      <header>
        <h3 className="text-sm font-semibold text-ink-900">Record status for {period}</h3>
        <p className="mt-1 text-xs text-ink-500">
          Pick a status per deliverable; latest wins per period. Click Recompute above to refresh the report card.
        </p>
      </header>
      <ul className="grid gap-2">
        {flat.map((row) => (
          <StatusRow key={row.deliverable_id} row={row} period={period} compactId={compact.id} onSaved={onSaved} />
        ))}
      </ul>
    </section>
  );
}

function StatusRow({
  row,
  period,
  onSaved,
}: {
  row: { pillar: string; pledge: string; ministry: string | null; deliverable_id: string; deliverable_title: string };
  period: string;
  compactId: string;
  onSaved: () => void;
}) {
  const upsert = useServerFn(upsertDeliverableStatus);
  const [status, setStatus] = useState<StatusStatus | "">("");
  const [narrative, setNarrative] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          deliverableId: row.deliverable_id,
          period,
          status: status as StatusStatus,
          narrative: narrative || undefined,
          evidenceUrl: evidenceUrl || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(`Status saved · ${row.deliverable_title.slice(0, 40)}…`);
      setNarrative("");
      setEvidenceUrl("");
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <li className="grid gap-2 rounded-lg border border-line-100 bg-paper-50 p-3 md:grid-cols-[1fr_auto] md:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium text-ink-900">{row.deliverable_title}</span>
          <span className="text-[10px] uppercase tracking-wide text-ink-400">
            {row.ministry ?? "Unassigned"} · {row.pillar}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-500">Pledge: {row.pledge}</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <input
            className="input h-8 text-xs"
            placeholder="Evidence URL (optional)"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
          />
          <input
            className="input h-8 text-xs"
            placeholder="Narrative (optional)"
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          className="input h-8 text-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusStatus | "")}
        >
          <option value="">Select status…</option>
          <option value="delivered">Delivered</option>
          <option value="on_track">On track</option>
          <option value="at_risk">At risk</option>
          <option value="off_track">Off track</option>
          <option value="broken">Broken</option>
        </select>
        <button
          type="button"
          className="btn-secondary"
          disabled={!status || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </button>
      </div>
    </li>
  );
}

// ────────────────────────── Slice D · Publish ──────────────────────────

function PublishPanel({ countryCode, compact }: { countryCode: string; compact: CompactRow }) {
  const qc = useQueryClient();
  const sign = useServerFn(signMandateCompact);
  const activate = useServerFn(activateMandateCompact);
  const conclude = useServerFn(concludeMandateCompact);
  const [reason, setReason] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mandate-compacts", countryCode] });
    qc.invalidateQueries({ queryKey: ["mandate-compact-detail", compact.id] });
  };

  const signMut = useMutation({
    mutationFn: () => sign({ data: { compactId: compact.id, reason: reason.trim() || undefined } }),
    onSuccess: (r) => { toast.success(r.unchanged ? "Already signed" : `Signed · revision ${r.revision_number}`); invalidate(); setReason(""); },
    onError: (err: Error) => toast.error(err.message),
  });
  const activateMut = useMutation({
    mutationFn: () => activate({ data: { compactId: compact.id, reason: reason.trim() || undefined } }),
    onSuccess: (r) => { toast.success(r.unchanged ? "Already in force" : `Activated · revision ${r.revision_number}`); invalidate(); setReason(""); },
    onError: (err: Error) => toast.error(err.message),
  });
  const concludeMut = useMutation({
    mutationFn: () => conclude({ data: { compactId: compact.id, reason: reason.trim() || undefined } }),
    onSuccess: (r) => { toast.success(r.unchanged ? "Already concluded" : `Concluded · revision ${r.revision_number}`); invalidate(); setReason(""); },
    onError: (err: Error) => toast.error(err.message),
  });

  const status = compact.status;
  const canSign = status === "draft";
  const canActivate = status === "signed";
  const canConclude = status === "in_force";
  const busy = signMut.isPending || activateMut.isPending || concludeMut.isPending;

  return (
    <section className="grid gap-4 rounded-2xl border border-line-200 bg-paper-0 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-900">Publish the compact</h2>
          <p className="mt-1 text-sm text-ink-500">
            Sign the compact to freeze it, then activate it so it lights up the Country Console.
            Every transition writes an audit revision with a full snapshot.
          </p>
        </div>
        <StatusPill status={status} />
      </header>

      <ol className="grid gap-3 md:grid-cols-3">
        <TransitionCard
          n={1} icon={PenLine} label="Sign" tone={canSign ? "primary" : "muted"}
          body="Freeze pillars, pledges, and deliverables. Marks signed_at and creates rev-1."
          disabled={!canSign || busy} loading={signMut.isPending}
          onClick={() => signMut.mutate()}
        />
        <TransitionCard
          n={2} icon={PlayCircle} label="Activate" tone={canActivate ? "primary" : "muted"}
          body="Compact goes into force. It becomes the live PM Report Card in each minister's console."
          disabled={!canActivate || busy} loading={activateMut.isPending}
          onClick={() => activateMut.mutate()}
        />
        <TransitionCard
          n={3} icon={Flag} label="Conclude" tone={canConclude ? "primary" : "muted"}
          body="Term ends. Report card is frozen for the historical record."
          disabled={!canConclude || busy} loading={concludeMut.isPending}
          onClick={() => concludeMut.mutate()}
        />
      </ol>

      <label className="grid gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-500">Change note (optional)</span>
        <textarea
          className="input min-h-[70px]"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Cabinet reshuffle · added Ministry of Energy Transition as lead for pledge 3.2"
        />
      </label>
    </section>
  );
}

function TransitionCard({
  n, icon: Icon, label, body, disabled, loading, onClick, tone,
}: {
  n: number; icon: any; label: string; body: string; disabled?: boolean; loading?: boolean;
  onClick: () => void; tone: "primary" | "muted";
}) {
  return (
    <li className={cn(
      "flex flex-col justify-between gap-3 rounded-xl border p-4",
      tone === "primary" ? "border-gold-500 bg-paper-0" : "border-line-200 bg-paper-50",
    )}>
      <div className="flex items-start gap-3">
        <span className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          tone === "primary" ? "bg-gold-500 text-ink-950" : "bg-paper-100 text-ink-500",
        )}>{n}</span>
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Icon className="h-4 w-4" /> {label}
          </h3>
          <p className="mt-1 text-xs text-ink-500">{body}</p>
        </div>
      </div>
      <button
        type="button"
        className={tone === "primary" ? "btn-primary w-full" : "btn-ghost w-full"}
        disabled={disabled}
        onClick={onClick}
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Working…</> : label}
      </button>
    </li>
  );
}
