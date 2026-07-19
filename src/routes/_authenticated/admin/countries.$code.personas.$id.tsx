import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getPersona } from "@/lib/personas/generate.functions";
import { askPersona, getPersonaChat, listPersonaChats } from "@/lib/personas/study.functions";

function personaQuery(id: string) {
  return queryOptions({ queryKey: ["persona", id], queryFn: () => getPersona({ data: { id } }) });
}
function chatsQuery(id: string) {
  return queryOptions({ queryKey: ["persona-chats", id], queryFn: () => listPersonaChats({ data: { personaId: id } }) });
}

export const Route = createFileRoute("/_authenticated/admin/countries/$code/personas/$id")({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(personaQuery(params.id)),
      context.queryClient.ensureQueryData(chatsQuery(params.id)),
    ]);
  },
  errorComponent: ({ error }) => <p className="p-6 text-sm text-rose-600">{error.message}</p>,
  component: PersonaDetail,
});

function PersonaDetail() {
  const { code, id } = Route.useParams();
  const qc = useQueryClient();
  const { data: persona } = useSuspenseQuery(personaQuery(id));
  const { data: chats } = useSuspenseQuery(chatsQuery(id));
  const [chatId, setChatId] = useState<string | null>(chats[0]?.id ?? null);

  const messagesQuery = useSuspenseQuery({
    queryKey: ["persona-chat", chatId],
    queryFn: () => (chatId ? getPersonaChat({ data: { chatId } }) : Promise.resolve([])),
  });
  const messages = messagesQuery.data;

  const [input, setInput] = useState("");
  const ask = useMutation({
    mutationFn: () => askPersona({ data: { personaId: id, chatId: chatId ?? undefined, message: input.trim() } }),
    onSuccess: (res) => {
      setInput("");
      setChatId(res.chatId);
      qc.invalidateQueries({ queryKey: ["persona-chat", res.chatId] });
      qc.invalidateQueries({ queryKey: ["persona-chats", id] });
    },
  });

  if (!persona) return <p className="p-6 text-sm text-ink-500">Persona not found.</p>;

  const attrs = (persona.attributes ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <Link
        to="/admin/countries/$code/personas"
        params={{ code }}
        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500 hover:text-ink-950"
      >
        <ArrowLeft size={12} /> All personas
      </Link>

      <header className="border-b border-line-200 pb-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
          {persona.archetype ?? "Persona"} · {persona.visibility}
        </p>
        <h2 className="mt-1 font-serif text-2xl text-ink-950">{persona.name}</h2>
        {persona.summary && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-700">{persona.summary}</p>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Attributes</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
            {Object.entries(attrs).map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500">{k}</dt>
                <dd className="text-ink-950">
                  {Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex min-h-[400px] flex-col border border-line-200 bg-paper-0">
          <div className="flex items-center justify-between border-b border-line-200 px-3 py-2">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              <Sparkles size={11} /> Ask {persona.name.split(" ")[0]}
            </p>
            <select
              value={chatId ?? ""}
              onChange={(e) => setChatId(e.target.value || null)}
              className="border border-line-200 bg-paper-0 px-2 py-1 text-[11px]"
            >
              <option value="">+ New conversation</option>
              {chats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title ?? "Untitled"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 && (
              <p className="text-[12px] italic text-ink-500">
                Ask this persona anything. They&rsquo;ll answer in character, grounded in {code}&rsquo;s brain.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-500">
                  {m.role === "user" ? "You" : persona.name}
                </p>
                <div
                  className={`prose prose-sm mt-1 inline-block max-w-full text-left ${
                    m.role === "user" ? "bg-ink-950 px-3 py-2 text-paper-0" : ""
                  }`}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {ask.isPending && <p className="text-[12px] italic text-ink-500">Thinking…</p>}
          </div>
          <div className="border-t border-line-200 p-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim().length > 0 && !ask.isPending) ask.mutate();
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a question…"
                className="flex-1 border border-line-200 bg-paper-0 px-2 py-2 text-sm focus:border-ink-950 focus:outline-none"
              />
              <button
                type="submit"
                disabled={ask.isPending || input.trim().length === 0}
                className="inline-flex items-center gap-1 border border-ink-950 bg-ink-950 px-3 py-2 text-[11px] text-paper-0 hover:bg-ink-700 disabled:opacity-40"
              >
                <Send size={12} /> Ask
              </button>
            </form>
            {ask.isError && <p className="mt-1 text-[11px] text-rose-600">{(ask.error as Error).message}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
