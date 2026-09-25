// Share links for one project: create (approvers, approved projects, flag on),
// show the full link once, list with view statistics, revoke.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Explain } from "@/components/explain/Explain";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createShareLink,
  getLinksEnabled,
  listShareLinks,
  revokeShareLink,
  setLinksEnabled,
  type ShareLinkStatus,
} from "@/lib/investments/share-links.functions";
import { PACKAGE_KIND_LABEL, PACKAGE_KINDS, type PackageKind } from "@/lib/syndication/db";
import { cn } from "@/lib/utils";

import { Dot, ErrorText, errMessage, Field, formatDate, inputCls, MicroLabel, Note } from "./ui";

const STATUS: Record<
  ShareLinkStatus,
  { label: string; cls: string; dot: "positive" | "muted" | "negative" | "caution" }
> = {
  active: { label: "Active", cls: "text-signal-positive", dot: "positive" },
  expired: { label: "Expired", cls: "text-ink-500", dot: "muted" },
  revoked: { label: "Revoked", cls: "text-signal-negative", dot: "negative" },
  used_up: { label: "View limit reached", cls: "text-signal-caution", dot: "caution" },
};

export function ShareLinksPanel({
  code,
  projectId,
  projectApproved,
  canApprove,
  onChanged,
}: {
  code: string;
  projectId: string;
  projectApproved: boolean;
  canApprove: boolean;
  onChanged?: () => void;
}) {
  const fetchFlag = useServerFn(getLinksEnabled);
  const toggleFlag = useServerFn(setLinksEnabled);
  const fetchLinks = useServerFn(listShareLinks);
  const revoke = useServerFn(revokeShareLink);
  const qc = useQueryClient();

  const flag = useQuery({ queryKey: ["share-links-flag"], queryFn: () => fetchFlag() });
  const links = useQuery({
    queryKey: ["share-links", code, projectId],
    queryFn: () => fetchLinks({ data: { code, projectId } }),
  });
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const enabled = !!flag.data?.enabled;
  const canCreate = enabled && projectApproved && canApprove;

  async function doToggle(next: boolean) {
    setErr(null);
    setBusy("flag");
    try {
      await toggleFlag({ data: { enabled: next } });
      await qc.invalidateQueries({ queryKey: ["share-links-flag"] });
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function doRevoke(id: string, label: string) {
    if (
      !window.confirm(
        `Revoke the link for “${label}”? Anyone holding it will see “This link is not available”. This cannot be undone.`,
      )
    )
      return;
    setErr(null);
    setBusy(id);
    try {
      await revoke({ data: { code, id } });
      await qc.invalidateQueries({ queryKey: ["share-links", code, projectId] });
      onChanged?.();
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {flag.data && !enabled && (
        <Note tone="muted" title="Public project links are switched off">
          <p>
            No new links can be created, and existing links show “This link is not available” until
            they are switched on for this installation.
          </p>
          {flag.data.canToggle && (
            <button
              type="button"
              className="btn-secondary mt-2 px-3 py-1.5 text-xs"
              disabled={busy === "flag"}
              onClick={() => doToggle(true)}
            >
              Switch on public links
            </button>
          )}
        </Note>
      )}
      {enabled && !projectApproved && (
        <Note tone="caution" title="Only an approved project can be shared">
          Links already created are paused and show “This link is not available” until the project
          is approved again.
        </Note>
      )}
      {enabled && projectApproved && !canApprove && (
        <Note tone="muted">
          Only an investment approver (country admin, cabinet secretary or principal) can create or
          revoke links.
        </Note>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-700">
          Each link opens a read-only page with the approved project facts and the investor
          materials you choose. Links expire, can be limited to a number of views, and can be
          revoked at any time.
        </p>
        <div className="flex gap-2">
          {flag.data?.canToggle && enabled && (
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs"
              disabled={busy === "flag"}
              onClick={() => doToggle(false)}
            >
              Switch off public links
            </button>
          )}
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-xs"
            disabled={!canCreate}
            onClick={() => setCreating(true)}
          >
            Create share link
          </button>
        </div>
      </div>
      <ErrorText>{err}</ErrorText>

      {links.isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {links.error && <ErrorText>{errMessage(links.error)}</ErrorText>}
      {links.data && links.data.length === 0 && (
        <p className="text-sm text-ink-500">No links yet.</p>
      )}
      {links.data && links.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line-200 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">
              <tr>
                <th className="py-2 pr-3">Sent to</th>
                <th className="pr-3">Link</th>
                <th className="pr-3">Status</th>
                <th className="pr-3">Expires</th>
                <th className="pr-3">Views</th>
                <th className="pr-3">Interest</th>
                <th className="pr-3">Last viewed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {links.data.map((l) => {
                const s = STATUS[l.status];
                return (
                  <tr key={l.id} className="border-b border-line-100 align-top">
                    <td className="py-2 pr-3 text-ink-950">
                      {l.label}
                      <div className="text-[11px] text-ink-500">
                        {l.include_packages.length
                          ? l.include_packages.map((k) => PACKAGE_KIND_LABEL[k] ?? k).join(", ")
                          : "Project facts only"}
                        {l.allow_interest ? " · interest form on" : " · interest form off"}
                      </div>
                    </td>
                    <td className="pr-3 font-mono text-xs text-ink-700">/i/…{l.token_hint}</td>
                    <td className={cn("pr-3 text-xs", s.cls)}>
                      <span className="inline-flex items-center gap-1.5">
                        <Dot tone={s.dot} />
                        {s.label}
                      </span>
                      {l.status === "active" && !projectApproved && (
                        <div className="text-[11px] text-signal-caution">Paused</div>
                      )}
                    </td>
                    <td className="pr-3 text-xs tabular-nums text-ink-700">
                      {formatDate(l.expires_at)}
                    </td>
                    <td className="pr-3 text-xs tabular-nums text-ink-950">
                      <Explain
                        id="investments.link_views"
                        ctx={{
                          views: l.stats.views,
                          visitors: l.stats.visitors,
                          maxViews: l.max_views,
                          viewCount: l.view_count,
                        }}
                      >
                        {l.stats.views}
                        {l.max_views != null ? ` / ${l.max_views}` : ""} · {l.stats.visitors}{" "}
                        visitor{l.stats.visitors === 1 ? "" : "s"}
                      </Explain>
                    </td>
                    <td className="pr-3 text-xs tabular-nums text-ink-700">{l.stats.interests}</td>
                    <td className="pr-3 text-xs tabular-nums text-ink-700">
                      {l.stats.lastViewedAt ? formatDate(l.stats.lastViewedAt, true) : "—"}
                    </td>
                    <td className="text-right">
                      {canApprove && !l.revoked_at && (
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-xs"
                          disabled={busy === l.id}
                          onClick={() => doRevoke(l.id, l.label)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateLinkDialog
        open={creating}
        onOpenChange={setCreating}
        code={code}
        projectId={projectId}
        onCreated={async () => {
          await qc.invalidateQueries({ queryKey: ["share-links", code, projectId] });
          onChanged?.();
        }}
      />
    </div>
  );
}

function CreateLinkDialog({
  open,
  onOpenChange,
  code,
  projectId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  code: string;
  projectId: string;
  onCreated: () => void | Promise<void>;
}) {
  const create = useServerFn(createShareLink);
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("30");
  const [maxViews, setMaxViews] = useState("");
  const [allowInterest, setAllowInterest] = useState(true);
  const [kinds, setKinds] = useState<PackageKind[]>(["teaser"]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; label: string; expires_at: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  function reset() {
    setLabel("");
    setDays("30");
    setMaxViews("");
    setAllowInterest(true);
    setKinds(["teaser"]);
    setErr(null);
    setResult(null);
    setCopied(false);
  }

  async function submit() {
    setErr(null);
    const d = Number(days);
    if (!Number.isInteger(d) || d < 1 || d > 180)
      return setErr("A link lasts between 1 and 180 days.");
    const mv = maxViews.trim() === "" ? null : Number(maxViews);
    if (mv != null && (!Number.isInteger(mv) || mv < 1))
      return setErr("The view limit must be a whole number above zero.");
    if (label.trim().length < 2) return setErr("Say who the link is for.");
    setBusy(true);
    try {
      const r = await create({
        data: {
          code,
          projectId,
          label: label.trim(),
          expiresInDays: d,
          maxViews: mv,
          allowInterest,
          includePackages: kinds,
        },
      });
      setResult({ url: r.url, label: r.label, expires_at: r.expires_at });
      await onCreated();
    } catch (e) {
      setErr(errMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg rounded-none border-line-200 bg-paper-0 sm:rounded-none">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-normal text-ink-950">
            {result ? "Link created" : "Create a share link"}
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-600">
            {result
              ? "Copy it now. For security only a fingerprint is stored, so the full link cannot be shown again."
              : "A read-only page for one investor or institution. Name who it is for so views and replies can be traced."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div>
              <MicroLabel>
                For {result.label} · expires {formatDate(result.expires_at)}
              </MicroLabel>
              <input
                readOnly
                className={cn(inputCls, "mt-1 font-mono text-xs")}
                value={result.url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Share link"
              />
            </div>
            <div className="flex items-center gap-3">
              <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={copy}>
                {copied ? "Copied" : "Copy link"}
              </button>
              <button
                type="button"
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Field
              label="Who is it for?"
              hint="e.g. “IFC — infrastructure desk”. Shown only to your team."
            >
              <input
                className={inputCls}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expires after (days)" hint="1 to 180.">
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </Field>
              <Field label="View limit" hint="Leave empty for no limit.">
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={maxViews}
                  onChange={(e) => setMaxViews(e.target.value)}
                />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-1 text-xs text-ink-700">Investor materials to include</legend>
              <p className="mb-2 text-[11px] text-ink-500">
                Only approved materials for the current version of the project are shown.
              </p>
              <div className="flex flex-wrap gap-4">
                {PACKAGE_KINDS.map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm text-ink-800">
                    <input
                      type="checkbox"
                      checked={kinds.includes(k)}
                      onChange={(e) =>
                        setKinds((p) => (e.target.checked ? [...p, k] : p.filter((x) => x !== k)))
                      }
                    />
                    {PACKAGE_KIND_LABEL[k]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 text-sm text-ink-800">
              <input
                type="checkbox"
                checked={allowInterest}
                onChange={(e) => setAllowInterest(e.target.checked)}
              />
              Let the recipient express interest through the page
            </label>
            <ErrorText>{err}</ErrorText>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary px-3 py-1.5 text-xs"
                disabled={busy}
                onClick={submit}
              >
                {busy ? "Creating…" : "Create link"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
