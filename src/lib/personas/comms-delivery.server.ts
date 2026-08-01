// Chamber 07 · Participant mail delivery.
//
// Server-only. One place that knows how a message actually leaves the building,
// and one place that knows the merge grammar. When no mail provider is
// configured the message is still composed and logged — it is simply "ready"
// rather than "sent", and every surface says so plainly rather than pretending.

export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

export function merge(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => vars[k] ?? "");
}

/** True when this workspace can actually dispatch mail. */
export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.RESEARCH_FROM_EMAIL;
}

export async function deliver(args: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ status: "sent" | "ready"; error: string | null }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEARCH_FROM_EMAIL;
  if (!key || !from) {
    return { status: "ready", error: null };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [args.to], subject: args.subject, text: args.body }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { status: "ready", error: `Mail provider ${res.status}: ${t.slice(0, 200)}` };
    }
    return { status: "sent", error: null };
  } catch (e) {
    return { status: "ready", error: e instanceof Error ? e.message : "send failed" };
  }
}
