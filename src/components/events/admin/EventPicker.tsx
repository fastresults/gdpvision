import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListEvents } from "@/lib/events/admin.functions";

/** Dropdown of live (non-archived) editions shared by the Events Admin tools. */
export function EventPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const fn = useServerFn(adminListEvents);
  const q = useQuery({ queryKey: ["admin", "events"], queryFn: () => fn() });
  return (
    <label className="flex flex-wrap items-center gap-3 text-[14px] font-semibold">
      Edition
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[320px] rounded-lg border-2 border-ev-ink bg-ev-paper px-3 py-2 text-[14px]"
      >
        <option value="">Choose an edition…</option>
        {(q.data ?? []).map((e) => (
          <option key={e.id} value={e.id}>{e.title}</option>
        ))}
      </select>
    </label>
  );
}
