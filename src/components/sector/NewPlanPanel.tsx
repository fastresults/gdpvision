// Starts a Sector Development Plan for a priority sector: a short scope
// form. What the author answers becomes the "scope.*" lines of every pack.

import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";

import { createPlan } from "@/lib/sector/plan.functions";
import { HORIZON_OPTIONS } from "@/lib/sector/stages";
import { cn } from "@/lib/utils";

import { FIELD, MICRO } from "./labels";

export function NewPlanPanel({
  code,
  countryName,
  sector,
  ministries,
  onCreated,
  onCancel,
}: {
  code: string;
  countryName: string;
  sector: { code: string; label: string };
  ministries: string[];
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const create = useServerFn(createPlan);
  const [title, setTitle] = useState(`${countryName} ${sector.label} Sector Development Plan`);
  const [lead, setLead] = useState("");
  const [horizon, setHorizon] = useState<number>(5);
  const [ambition, setAmbition] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await create({
        data: {
          code,
          sector: sector.code,
          title,
          scope: { lead_ministry: lead, horizon_years: horizon, ambition, notes },
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
    <form onSubmit={onSubmit} className="border-l-2 border-gold-500 pl-5" aria-label="New plan">
      <div className={MICRO}>New plan · {sector.label}</div>
      <h2 className="mt-1 font-display text-2xl text-ink-950">Set the scope</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-700">
        Ten sections are then drafted in order from the country's corpus and the Sector Studio
        method — diagnostic to roadmap — each saying what it was written from and what it could not
        find.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={MICRO}>Title</span>
          <input
            className={cn(FIELD, "mt-1")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={160}
          />
        </label>
        <label className="block">
          <span className={MICRO}>Lead ministry</span>
          <input
            className={cn(FIELD, "mt-1")}
            value={lead}
            onChange={(e) => setLead(e.target.value)}
            list="sector-ministries"
            placeholder="The ministry that owns the number"
            maxLength={160}
          />
          <datalist id="sector-ministries">
            {ministries.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <fieldset>
          <legend className={MICRO}>Horizon</legend>
          <div className="mt-2 flex gap-4">
            {HORIZON_OPTIONS.map((h) => (
              <label key={h} className="flex items-center gap-2 text-sm text-ink-950">
                <input
                  type="radio"
                  name="horizon"
                  checked={horizon === h}
                  onChange={() => setHorizon(h)}
                />
                {h} years
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block sm:col-span-2">
          <span className={MICRO}>Ambition (optional)</span>
          <textarea
            className={cn(FIELD, "mt-1 min-h-20")}
            value={ambition}
            onChange={(e) => setAmbition(e.target.value)}
            maxLength={2000}
            placeholder="What the Head of Government has said this sector should become."
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={MICRO}>Notes for the drafting model</span>
          <textarea
            className={cn(FIELD, "mt-1 min-h-20")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={4000}
            placeholder="Decisions already taken, segments to include or exclude, the lab's findings."
          />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-signal-negative">{error}</p>}

      <div className="mt-6 flex items-center gap-3">
        <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={busy}>
          {busy ? "Creating…" : "Create plan"}
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
