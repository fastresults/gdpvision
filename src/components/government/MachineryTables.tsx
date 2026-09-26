// The machinery-of-government record as two review tables — offices of state
// and Cabinet, then statutory bodies — with per-row edit, verify, publish and
// retire, and bulk "verify and publish" for checked rows. Status is coloured
// text with a dot; surfaces stay light (house rules).

import { Fragment, useState, type ReactNode } from "react";

import {
  BODY_KINDS,
  BODY_KIND_LABEL,
  OFFICE_KEYS,
  OFFICE_LABEL,
  type BodyRow,
  type MachineryStatus,
  type OfficeRow,
  type Visibility,
} from "@/lib/government/db";
import { cn } from "@/lib/utils";

export const MICRO = "font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500";
const FIELD =
  "w-full border border-line-200 bg-paper-0 px-2 py-1.5 text-sm text-ink-950 focus:border-ink-950 focus:outline-none";

export type Action = "verify" | "publish" | "unpublish" | "retire" | "reopen";

function StatusCell({ status, visibility }: { status: MachineryStatus; visibility: Visibility }) {
  const meta =
    status === "verified" && visibility === "public"
      ? { label: "Public", cls: "text-signal-positive border-signal-positive" }
      : status === "verified"
        ? { label: "Verified · private", cls: "text-gold-500 border-gold-500" }
        : status === "retired"
          ? { label: "Retired", cls: "text-ink-400 border-line-200" }
          : { label: "Draft", cls: "text-draft-state border-draft-state" };
  return (
    <span className={cn("text-xs", meta.cls.split(" ")[0])}>
      <span
        className={cn(
          "mr-1.5 inline-block h-1.5 w-1.5 rounded-full border bg-current",
          meta.cls.split(" ")[1],
        )}
      />
      {meta.label}
    </span>
  );
}

function RowActions({
  status,
  visibility,
  canEdit,
  onAction,
  onEdit,
}: {
  status: MachineryStatus;
  visibility: Visibility;
  canEdit: boolean;
  onAction: (a: Action) => void;
  onEdit: () => void;
}) {
  if (!canEdit) return null;
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <button type="button" className="btn-ghost px-2 py-0.5 text-xs" onClick={onEdit}>
        Edit
      </button>
      {status === "draft" && (
        <button
          type="button"
          className="btn-ghost px-2 py-0.5 text-xs"
          onClick={() => onAction("verify")}
        >
          Verify
        </button>
      )}
      {status !== "retired" && visibility === "private" && (
        <button
          type="button"
          className="btn-secondary px-2 py-0.5 text-xs"
          onClick={() => onAction("publish")}
        >
          {status === "verified" ? "Publish" : "Verify & publish"}
        </button>
      )}
      {visibility === "public" && (
        <button
          type="button"
          className="btn-ghost px-2 py-0.5 text-xs"
          onClick={() => onAction("unpublish")}
        >
          Unpublish
        </button>
      )}
      {status !== "retired" ? (
        <button
          type="button"
          className="btn-ghost px-2 py-0.5 text-xs"
          onClick={() => onAction("retire")}
        >
          Retire
        </button>
      ) : (
        <button
          type="button"
          className="btn-ghost px-2 py-0.5 text-xs"
          onClick={() => onAction("reopen")}
        >
          Reopen
        </button>
      )}
    </div>
  );
}

function Label({ children, span2 }: { children: ReactNode; span2?: boolean }) {
  return (
    <label className={cn("block text-xs text-ink-500", span2 && "sm:col-span-2")}>{children}</label>
  );
}

// ------------------------------------------------------------------ offices

export type OfficeDraft = {
  id?: string;
  office_key: OfficeRow["office_key"];
  title: string;
  holder_name: string;
  ministry_slug: string;
  portfolio: string;
  party: string;
  appointed_on: string;
  portrait_url: string;
  source_url: string;
};

export function OfficeForm({
  initial,
  ministries,
  onSave,
  onCancel,
}: {
  initial: OfficeDraft;
  ministries: Array<{ slug: string; name: string }>;
  onSave: (d: OfficeDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof OfficeDraft, v: string) => setD((x) => ({ ...x, [k]: v }));
  return (
    <div className="border-l-2 border-gold-500 pl-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Label>
          Office
          <select
            className={cn(FIELD, "mt-1")}
            value={d.office_key}
            onChange={(e) => set("office_key", e.target.value)}
          >
            {OFFICE_KEYS.map((k) => (
              <option key={k} value={k}>
                {OFFICE_LABEL[k]}
              </option>
            ))}
          </select>
        </Label>
        <Label>
          Official title
          <input
            className={cn(FIELD, "mt-1")}
            value={d.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </Label>
        <Label>
          Holder
          <input
            className={cn(FIELD, "mt-1")}
            value={d.holder_name}
            onChange={(e) => set("holder_name", e.target.value)}
          />
        </Label>
        <Label>
          Heads ministry
          <select
            className={cn(FIELD, "mt-1")}
            value={d.ministry_slug}
            onChange={(e) => set("ministry_slug", e.target.value)}
          >
            <option value="">—</option>
            {ministries.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
        </Label>
        <Label span2>
          Portfolio
          <input
            className={cn(FIELD, "mt-1")}
            value={d.portfolio}
            onChange={(e) => set("portfolio", e.target.value)}
          />
        </Label>
        <Label>
          Party
          <input
            className={cn(FIELD, "mt-1")}
            value={d.party}
            onChange={(e) => set("party", e.target.value)}
          />
        </Label>
        <Label>
          Appointed (YYYY-MM-DD)
          <input
            className={cn(FIELD, "mt-1")}
            value={d.appointed_on}
            onChange={(e) => set("appointed_on", e.target.value)}
          />
        </Label>
        <Label>
          Portrait URL
          <input
            className={cn(FIELD, "mt-1")}
            value={d.portrait_url}
            onChange={(e) => set("portrait_url", e.target.value)}
          />
        </Label>
        <Label>
          Source URL
          <input
            className={cn(FIELD, "mt-1")}
            value={d.source_url}
            onChange={(e) => set("source_url", e.target.value)}
          />
        </Label>
      </div>
      {error && <p className="mt-2 text-sm text-signal-negative">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-xs"
          disabled={busy || d.title.trim().length < 2}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onSave(d);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={onCancel}>
          Cancel
        </button>
        <span className="ml-auto self-center text-xs text-ink-500">
          Saving a verified record returns it to draft.
        </span>
      </div>
    </div>
  );
}

export function officeDraft(o?: OfficeRow): OfficeDraft {
  return {
    id: o?.id,
    office_key: o?.office_key ?? "cabinet_minister",
    title: o?.title ?? "",
    holder_name: o?.holder_name ?? "",
    ministry_slug: o?.ministry_slug ?? "",
    portfolio: o?.portfolio ?? "",
    party: o?.party ?? "",
    appointed_on: o?.appointed_on ?? "",
    portrait_url: o?.portrait_url ?? "",
    source_url: o?.source_url ?? "",
  };
}

export function OfficesTable({
  offices,
  ministries,
  canEdit,
  onAction,
  onSave,
}: {
  offices: OfficeRow[];
  ministries: Array<{ slug: string; name: string }>;
  canEdit: boolean;
  onAction: (ids: string[], a: Action) => Promise<void>;
  onSave: (d: OfficeDraft) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const mName = new Map(ministries.map((m) => [m.slug, m.name]));
  const toggle = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <div>
      {canEdit && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-xs"
            onClick={() => setEditing("new")}
          >
            Add an office
          </button>
          {checked.size > 0 && (
            <button
              type="button"
              className="btn-secondary px-2 py-1 text-xs"
              onClick={async () => {
                await onAction([...checked], "publish");
                setChecked(new Set());
              }}
            >
              Verify & publish {checked.size} checked
            </button>
          )}
        </div>
      )}
      {editing === "new" && (
        <div className="mb-4">
          <OfficeForm
            initial={officeDraft()}
            ministries={ministries}
            onCancel={() => setEditing(null)}
            onSave={async (d) => {
              await onSave(d);
              setEditing(null);
            }}
          />
        </div>
      )}
      <table className="w-full border-t border-line-200 text-sm">
        <thead>
          <tr className="text-left">
            {["", "Office", "Holder", "Portfolio / ministry", "Source", "Status", ""].map(
              (h, i) => (
                <th key={i} className={cn(MICRO, "border-b border-line-200 py-2 pr-3 font-normal")}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {offices.map((o) => (
            <Fragment key={o.id}>
              <tr className="border-b border-line-200 align-top">
                <td className="py-2 pr-2">
                  {canEdit && o.status !== "retired" && (
                    <input
                      type="checkbox"
                      checked={checked.has(o.id)}
                      onChange={() => toggle(o.id)}
                      aria-label={`Select ${o.title}`}
                    />
                  )}
                </td>
                <td className="py-2 pr-3">
                  <div className="text-ink-950">{o.title}</div>
                  <div className="text-xs text-ink-500">
                    {OFFICE_LABEL[o.office_key]} · {o.precedence}
                  </div>
                </td>
                <td className="py-2 pr-3 text-ink-950">
                  {o.holder_name ?? <span className="text-ink-400">Not named</span>}
                  {o.party && <div className="text-xs text-ink-500">{o.party}</div>}
                </td>
                <td className="py-2 pr-3 text-xs text-ink-700">
                  {o.portfolio || "—"}
                  {o.ministry_slug && (
                    <div className="text-ink-500">
                      {mName.get(o.ministry_slug) ?? o.ministry_slug}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs text-ink-500">
                  {o.origin} · {o.confidence}
                  {o.source_url && (
                    <a
                      href={o.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate underline decoration-line-200 underline-offset-4 hover:text-ink-950"
                    >
                      source
                    </a>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <StatusCell status={o.status} visibility={o.visibility} />
                </td>
                <td className="py-2">
                  <RowActions
                    status={o.status}
                    visibility={o.visibility}
                    canEdit={canEdit}
                    onAction={(a) => onAction([o.id], a)}
                    onEdit={() => setEditing(editing === o.id ? null : o.id)}
                  />
                </td>
              </tr>
              {editing === o.id && (
                <tr className="border-b border-line-200">
                  <td colSpan={7} className="py-3">
                    <OfficeForm
                      initial={officeDraft(o)}
                      ministries={ministries}
                      onCancel={() => setEditing(null)}
                      onSave={async (d) => {
                        await onSave(d);
                        setEditing(null);
                      }}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ bodies

export type BodyDraft = {
  id?: string;
  name: string;
  acronym: string;
  kind: BodyRow["kind"];
  parent_ministry_slug: string;
  enabling_act: string;
  act_year: string;
  mandate: string;
  head_name: string;
  head_title: string;
  board_chair: string;
  sector_code: string;
  services: string;
  website: string;
  source_url: string;
};

export function bodyDraft(b?: BodyRow): BodyDraft {
  return {
    id: b?.id,
    name: b?.name ?? "",
    acronym: b?.acronym ?? "",
    kind: b?.kind ?? "statutory_body",
    parent_ministry_slug: b?.parent_ministry_slug ?? "",
    enabling_act: b?.enabling_act ?? "",
    act_year: b?.act_year ? String(b.act_year) : "",
    mandate: b?.mandate ?? "",
    head_name: b?.head_name ?? "",
    head_title: b?.head_title ?? "",
    board_chair: b?.board_chair ?? "",
    sector_code: b?.sector_code ?? "",
    services: (b?.services ?? []).join("\n"),
    website: b?.website ?? "",
    source_url: b?.source_url ?? "",
  };
}

export function BodyForm({
  initial,
  ministries,
  sectors,
  onSave,
  onCancel,
}: {
  initial: BodyDraft;
  ministries: Array<{ slug: string; name: string }>;
  sectors: Array<{ code: string; label: string }>;
  onSave: (d: BodyDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof BodyDraft, v: string) => setD((x) => ({ ...x, [k]: v }));
  return (
    <div className="border-l-2 border-gold-500 pl-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Label>
          Name
          <input
            className={cn(FIELD, "mt-1")}
            value={d.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Label>
        <Label>
          Acronym
          <input
            className={cn(FIELD, "mt-1")}
            value={d.acronym}
            onChange={(e) => set("acronym", e.target.value)}
          />
        </Label>
        <Label>
          Kind
          <select
            className={cn(FIELD, "mt-1")}
            value={d.kind}
            onChange={(e) => set("kind", e.target.value)}
          >
            {BODY_KINDS.map((k) => (
              <option key={k} value={k}>
                {BODY_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Label>
        <Label>
          Parent ministry
          <select
            className={cn(FIELD, "mt-1")}
            value={d.parent_ministry_slug}
            onChange={(e) => set("parent_ministry_slug", e.target.value)}
          >
            <option value="">—</option>
            {ministries.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
        </Label>
        <Label>
          Enabling Act
          <input
            className={cn(FIELD, "mt-1")}
            value={d.enabling_act}
            onChange={(e) => set("enabling_act", e.target.value)}
          />
        </Label>
        <Label>
          Year
          <input
            className={cn(FIELD, "mt-1")}
            value={d.act_year}
            onChange={(e) => set("act_year", e.target.value)}
            inputMode="numeric"
          />
        </Label>
        <Label span2>
          Mandate
          <textarea
            className={cn(FIELD, "mt-1 min-h-16")}
            value={d.mandate}
            onChange={(e) => set("mandate", e.target.value)}
          />
        </Label>
        <Label>
          Head
          <input
            className={cn(FIELD, "mt-1")}
            value={d.head_name}
            onChange={(e) => set("head_name", e.target.value)}
          />
        </Label>
        <Label>
          Head's title
          <input
            className={cn(FIELD, "mt-1")}
            value={d.head_title}
            onChange={(e) => set("head_title", e.target.value)}
          />
        </Label>
        <Label>
          Board chair
          <input
            className={cn(FIELD, "mt-1")}
            value={d.board_chair}
            onChange={(e) => set("board_chair", e.target.value)}
          />
        </Label>
        <Label>
          Sector
          <select
            className={cn(FIELD, "mt-1")}
            value={d.sector_code}
            onChange={(e) => set("sector_code", e.target.value)}
          >
            <option value="">—</option>
            {sectors.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </Label>
        <Label span2>
          Services (one per line)
          <textarea
            className={cn(FIELD, "mt-1 min-h-16")}
            value={d.services}
            onChange={(e) => set("services", e.target.value)}
          />
        </Label>
        <Label>
          Website
          <input
            className={cn(FIELD, "mt-1")}
            value={d.website}
            onChange={(e) => set("website", e.target.value)}
          />
        </Label>
        <Label>
          Source URL
          <input
            className={cn(FIELD, "mt-1")}
            value={d.source_url}
            onChange={(e) => set("source_url", e.target.value)}
          />
        </Label>
      </div>
      {error && <p className="mt-2 text-sm text-signal-negative">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-xs"
          disabled={busy || d.name.trim().length < 2}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onSave(d);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function BodiesTable({
  bodies,
  ministries,
  sectors,
  canEdit,
  onAction,
  onSave,
}: {
  bodies: BodyRow[];
  ministries: Array<{ slug: string; name: string }>;
  sectors: Array<{ code: string; label: string }>;
  canEdit: boolean;
  onAction: (ids: string[], a: Action) => Promise<void>;
  onSave: (d: BodyDraft) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const mName = new Map(ministries.map((m) => [m.slug, m.name]));
  const toggle = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <div>
      {canEdit && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ghost px-2 py-1 text-xs"
            onClick={() => setEditing("new")}
          >
            Add a statutory body
          </button>
          {checked.size > 0 && (
            <button
              type="button"
              className="btn-secondary px-2 py-1 text-xs"
              onClick={async () => {
                await onAction([...checked], "publish");
                setChecked(new Set());
              }}
            >
              Verify & publish {checked.size} checked
            </button>
          )}
        </div>
      )}
      {editing === "new" && (
        <div className="mb-4">
          <BodyForm
            initial={bodyDraft()}
            ministries={ministries}
            sectors={sectors}
            onCancel={() => setEditing(null)}
            onSave={async (d) => {
              await onSave(d);
              setEditing(null);
            }}
          />
        </div>
      )}
      <table className="w-full border-t border-line-200 text-sm">
        <thead>
          <tr className="text-left">
            {["", "Body", "Parent ministry", "Enabling Act", "Head", "Status", ""].map((h, i) => (
              <th key={i} className={cn(MICRO, "border-b border-line-200 py-2 pr-3 font-normal")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodies.map((b) => (
            <Fragment key={b.id}>
              <tr className="border-b border-line-200 align-top">
                <td className="py-2 pr-2">
                  {canEdit && b.status !== "retired" && (
                    <input
                      type="checkbox"
                      checked={checked.has(b.id)}
                      onChange={() => toggle(b.id)}
                      aria-label={`Select ${b.name}`}
                    />
                  )}
                </td>
                <td className="py-2 pr-3">
                  <div className="text-ink-950">
                    {b.name}
                    {b.acronym && <span className="text-ink-500"> ({b.acronym})</span>}
                  </div>
                  <div className="max-w-md text-xs text-ink-500">
                    {BODY_KIND_LABEL[b.kind]}
                    {b.mandate
                      ? ` · ${b.mandate.slice(0, 140)}${b.mandate.length > 140 ? "…" : ""}`
                      : ""}
                  </div>
                </td>
                <td className="py-2 pr-3 text-xs text-ink-700">
                  {b.parent_ministry_slug ? (
                    (mName.get(b.parent_ministry_slug) ?? b.parent_ministry_slug)
                  ) : (
                    <span className="text-ink-400">Not linked</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs text-ink-700">
                  {b.enabling_act ?? "—"}
                  {b.act_year ? ` (${b.act_year})` : ""}
                </td>
                <td className="py-2 pr-3 text-xs text-ink-700">
                  {b.head_name ?? "—"}
                  {b.head_title && <div className="text-ink-500">{b.head_title}</div>}
                </td>
                <td className="py-2 pr-3">
                  <StatusCell status={b.status} visibility={b.visibility} />
                  <div className="text-[11px] text-ink-400">
                    {b.origin} · {b.confidence}
                  </div>
                </td>
                <td className="py-2">
                  <RowActions
                    status={b.status}
                    visibility={b.visibility}
                    canEdit={canEdit}
                    onAction={(a) => onAction([b.id], a)}
                    onEdit={() => setEditing(editing === b.id ? null : b.id)}
                  />
                </td>
              </tr>
              {editing === b.id && (
                <tr className="border-b border-line-200">
                  <td colSpan={7} className="py-3">
                    <BodyForm
                      initial={bodyDraft(b)}
                      ministries={ministries}
                      sectors={sectors}
                      onCancel={() => setEditing(null)}
                      onSave={async (d) => {
                        await onSave(d);
                        setEditing(null);
                      }}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
