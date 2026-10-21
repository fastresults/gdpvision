import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { adminCheckIn, adminListCheckins } from "@/lib/events/admin-toolkit.functions";
import { EventPicker } from "@/components/events/admin/EventPicker";

export const Route = createFileRoute("/_authenticated/events-admin/registrations")({
  head: () => ({ meta: [{ title: "Registrations & check-in — Events Admin" }, { name: "description", content: "Check delegates in on the day." }, { property: "og:title", content: "Registrations & check-in — Events Admin" }, { property: "og:description", content: "Check-in desk." }] }),
  component: RegistrationsPage,
});

const MSG: Record<string, string> = { ok: "Checked in", already: "Already checked in", cancelled: "Registration was cancelled", not_found: "No registration matches that code" };

function RegistrationsPage() {
  const [eventId, setEventId] = useState("");
  return (
    <div className="space-y-6">
      <h1 className="ev-display text-[56px]">Registrations &amp; check-in</h1>
      <p className="max-w-2xl text-[15px]">Attendee lists, waitlist moves and spreadsheet export are in <strong>Events → Attendees</strong>. Use this desk on the day to check delegates in by name or by scanning their badge code.</p>
      <EventPicker value={eventId} onChange={setEventId} />
      {eventId && <Desk eventId={eventId} />}
    </div>
  );
}

function Desk({ eventId }: { eventId: string }) {
  const listFn = useServerFn(adminListCheckins);
  const checkFn = useServerFn(adminCheckIn);
  const qc = useQueryClient();
  const key = ["events-admin", "checkins", eventId];
  const q = useQuery({ queryKey: key, queryFn: () => listFn({ data: { event_id: eventId } }) });
  const [search, setSearch] = useState("");
  const [code, setCode] = useState("");
  const [badgeFor, setBadgeFor] = useState<string | null>(null);
  const mut = useMutation({ mutationFn: (token: string) => checkFn({ data: { token } }), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const rows = (q.data ?? []).filter((r) => `${r.name} ${r.email} ${r.organisation ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const done = (q.data ?? []).filter((r) => r.checked_in_at).length;
  const field = "rounded-lg border-2 border-ev-ink bg-ev-paper px-3 py-2 text-[14px]";
  const badge = (q.data ?? []).find((r) => r.id === badgeFor);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="ev-display text-[40px] tabular-nums">{done} / {q.data?.length ?? 0} checked in</div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^[0-9a-f-]{36}$/i.test(code.trim())) mut.mutate(code.trim());
            setCode("");
          }}
        >
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Scan or paste badge code" aria-label="Badge code" className={`${field} w-[320px]`} />
          <button type="submit" className="ev-btn-dark !py-2 !text-[14px]">Check in</button>
        </form>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or organisation" aria-label="Search delegates" className={`${field} w-[300px]`} />
      </div>
      {mut.data && (
        <p className={`rounded-xl border-4 border-ev-ink p-3 text-[16px] font-bold ${mut.data.outcome === "ok" ? "bg-ev-palm text-ev-paper" : "bg-ev-mango"}`}>
          {MSG[mut.data.outcome]}{mut.data.name ? `: ${mut.data.name}` : ""}{mut.data.at ? ` at ${new Date(mut.data.at).toUTCString().slice(17, 22)} UTC` : ""}
        </p>
      )}
      {mut.error && <p className="text-signal-red">{(mut.error as Error).message}</p>}
      {q.isLoading ? <p>Loading…</p> : rows.length === 0 ? <p>No registrations yet.</p> : (
        <div className="overflow-x-auto rounded-2xl border-4 border-ev-ink bg-paper-0">
          <table className="w-full text-[14px]">
            <thead className="bg-ev-ink text-left text-ev-paper"><tr><th className="p-3">Delegate</th><th className="p-3">Status</th><th className="p-3">Checked in</th><th className="p-3" /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t-2 border-ev-ink/10">
                  <td className="p-3"><div className="font-semibold">{r.name}</div><div className="text-[12px] opacity-70">{r.email}{r.organisation ? ` · ${r.organisation}` : ""}</div></td>
                  <td className="p-3">{r.status === "waitlist" ? "Waitlist" : "Confirmed"}</td>
                  <td className="p-3">{r.checked_in_at ? new Date(r.checked_in_at).toUTCString().slice(5, 22) : "—"}</td>
                  <td className="p-3 whitespace-nowrap text-right">
                    <button type="button" className="btn-ghost" onClick={() => setBadgeFor(r.id)}>Badge</button>
                    <button type="button" className="btn-secondary ml-2" disabled={!!r.checked_in_at || mut.isPending} onClick={() => mut.mutate(r.checkin_token)}>Check in</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {badge && (
        <div className="flex flex-wrap items-center gap-6 rounded-2xl border-4 border-ev-ink bg-ev-paper p-6">
          <QRCodeSVG value={badge.checkin_token} size={160} />
          <div>
            <div className="ev-display text-[36px]">{badge.name}</div>
            <div className="text-[14px]">{badge.organisation}</div>
            <div className="mt-2 font-mono text-[11px]">{badge.checkin_token}</div>
            <div className="mt-3 flex gap-2">
              <button type="button" className="ev-btn-dark !py-2 !text-[14px]" onClick={() => window.print()}>Print badge</button>
              <button type="button" className="btn-ghost" onClick={() => setBadgeFor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
