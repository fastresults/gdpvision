// The scope wizard: a short form, not a multi-step tour. What the author
// answers here becomes the "scope.*" lines of every context pack.

import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";

import { createPrd } from "@/lib/egov/prd.functions";
import { AUDIENCE_OPTIONS, PRIORITY_OPTIONS } from "@/lib/egov/stages";
import { cn } from "@/lib/utils";

import { MICRO } from "./labels";

const field =
  "w-full border border-line-200 bg-paper-0 px-3 py-2 text-sm text-ink-950 focus:border-ink-950 focus:outline-none";

export function NewPrdPanel({
  code,
  countryName,
  onCreated,
  onCancel,
}: {
  code: string;
  countryName: string;
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const create = useServerFn(createPrd);
  const [title, setTitle] = useState(`${countryName} e-government platform`);
  const [platform, setPlatform] = useState(`Government of ${countryName}`);
  const [audiences, setAudiences] = useState<string[]>(AUDIENCE_OPTIONS.map((a) => a.key));
  const [priorities, setPriorities] = useState<string[]>(["services", "governance"]);
  const [hosting, setHosting] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, key: string) =>
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await create({
        data: {
          code,
          title,
          scope: { platform_name: platform, audiences, priorities, hosting, notes },
        },
      });
      onCreated(r.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="border-l-2 border-gold-500 pl-5" aria-label="New PRD">
      <div className={MICRO}>New PRD · {code}</div>
      <h2 className="mt-1 font-display text-2xl text-ink-950">Set the scope</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-700">
        Ten sections are then drafted in order from the country's corpus. Each says what it was
        written from, and what it could not find.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={MICRO}>Title</span>
          <input
            className={cn(field, "mt-1")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={160}
          />
        </label>
        <label className="block">
          <span className={MICRO}>Platform name (working)</span>
          <input
            className={cn(field, "mt-1")}
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            placeholder={`Government of ${countryName}`}
            maxLength={120}
          />
        </label>
        <label className="block">
          <span className={MICRO}>Hosting preference</span>
          <input
            className={cn(field, "mt-1")}
            value={hosting}
            onChange={(e) => setHosting(e.target.value)}
            placeholder="e.g. regional cloud, in-country data residency"
            maxLength={200}
          />
        </label>

        <fieldset>
          <legend className={MICRO}>Audiences</legend>
          <div className="mt-2 space-y-1.5">
            {AUDIENCE_OPTIONS.map((a) => (
              <label key={a.key} className="flex items-center gap-2 text-sm text-ink-950">
                <input
                  type="checkbox"
                  checked={audiences.includes(a.key)}
                  onChange={() => toggle(audiences, setAudiences, a.key)}
                />
                {a.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className={MICRO}>Priorities</legend>
          <div className="mt-2 space-y-1.5">
            {PRIORITY_OPTIONS.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-sm text-ink-950">
                <input
                  type="checkbox"
                  checked={priorities.includes(p.key)}
                  onChange={() => toggle(priorities, setPriorities, p.key)}
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block sm:col-span-2">
          <span className={MICRO}>Notes for the drafting model</span>
          <textarea
            className={cn(field, "mt-1 min-h-24")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={4000}
            placeholder="Constraints, decisions already taken, systems that must be kept."
          />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-signal-negative">{error}</p>}

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={busy}>
          {busy ? "Creating…" : "Create PRD"}
        </button>
        <button
          type="button"
          className="btn-ghost px-3 py-2 text-sm"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
