import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Trash2 } from "lucide-react";

import {
  deleteProformaScenario,
  listProformaScenarios,
  saveProformaScenario,
} from "@/lib/proforma/scenarios.functions";
import type { ProformaInput } from "@/lib/proforma/model";

/** Save, recall and delete named assumption sets. */
export function ScenarioBar({
  input,
  onLoad,
}: {
  input: ProformaInput;
  onLoad: (input: ProformaInput) => void;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listProformaScenarios);
  const save = useServerFn(saveProformaScenario);
  const remove = useServerFn(deleteProformaScenario);
  const [name, setName] = useState("");

  const scenarios = useQuery({ queryKey: ["proforma-scenarios"], queryFn: () => list() });

  const saveMut = useMutation({
    mutationFn: () =>
      save({ data: { name: name.trim() || "Untitled scenario", assumptions: input as never } }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["proforma-scenarios"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proforma-scenarios"] }),
  });

  const rows = (scenarios.data ?? []) as Array<{
    id: string;
    name: string;
    assumptions: unknown;
    updated_at: string;
  }>;

  return (
    <div className="border border-line-200 bg-paper-0 p-5 sm:p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Scenarios</div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this set of assumptions"
          className="min-w-[220px] flex-1 border border-line-200 bg-paper-0 px-3 py-2 text-[14px] text-ink-950 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-ink-700"
        />
        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] disabled:opacity-50"
        >
          {saveMut.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save
        </button>
      </div>

      {saveMut.isError ? (
        <p className="mt-3 text-[12.5px] text-[var(--signal-negative)]">
          {(saveMut.error as Error).message}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="mt-4 divide-y divide-line-100">
          {rows.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
              <button
                type="button"
                onClick={() => onLoad(s.assumptions as ProformaInput)}
                className="btn-ghost min-w-0 flex-1 px-2 py-1 text-left text-[13.5px] text-ink-950"
              >
                <span className="block truncate">{s.name}</span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">
                  {new Date(s.updated_at).toISOString().slice(0, 10)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => deleteMut.mutate(s.id)}
                aria-label={`Delete ${s.name}`}
                className="btn-ghost px-2 py-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[13px] text-ink-500">
          No saved scenarios yet. Adjust the assumptions and save the set you want to defend.
        </p>
      )}
    </div>
  );
}
