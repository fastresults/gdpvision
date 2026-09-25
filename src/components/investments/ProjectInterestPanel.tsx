// Interest in one project, for the project workspace.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { listInterests, type InterestView } from "@/lib/investments/investors.functions";
import { INTEREST_STAGES } from "@/lib/syndication/db";

import { InterestCard } from "./InterestCard";
import { InterestEditor } from "./InterestEditor";
import { ErrorText, errMessage } from "./ui";

export function ProjectInterestPanel({ code, projectId }: { code: string; projectId: string }) {
  const fetchI = useServerFn(listInterests);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["investor-interests", code, projectId],
    queryFn: () => fetchI({ data: { code, projectId } }),
  });
  const [editing, setEditing] = useState<InterestView | null>(null);
  const [adding, setAdding] = useState(false);

  const order = (s: string) => INTEREST_STAGES.indexOf(s as (typeof INTEREST_STAGES)[number]);
  const rows = [...(q.data?.interests ?? [])].sort((a, b) => order(b.stage) - order(a.stage));

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["investor-interests", code] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-700">
          Investors following this project, and enquiries received through its share links. The full
          pipeline across projects is on the{" "}
          <Link
            to="/admin/countries/$code/investors"
            params={{ code }}
            className="underline decoration-line-200 underline-offset-2"
          >
            Investors
          </Link>{" "}
          page.
        </p>
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-xs"
          onClick={() => setAdding(true)}
        >
          Add interest
        </button>
      </div>
      {q.isLoading && <p className="text-sm text-ink-500">Loading…</p>}
      {q.error && <ErrorText>{errMessage(q.error)}</ErrorText>}
      {q.data && rows.length === 0 && (
        <p className="text-sm text-ink-500">No interest recorded yet.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((i) => (
          <InterestCard
            key={i.id}
            interest={i}
            showProject={false}
            showStage
            onOpen={() => setEditing(i)}
          />
        ))}
      </div>

      {q.data && (
        <InterestEditor
          open={adding || !!editing}
          onOpenChange={(v) => {
            if (!v) {
              setAdding(false);
              setEditing(null);
            }
          }}
          code={code}
          interest={editing}
          defaultProjectId={projectId}
          projects={q.data.projects}
          investors={q.data.investors}
          userId={q.data.userId}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
