// Server-only lenient repair for AI structured output. Shared by every
// writer that asks the gateway for a Zod-shaped object, so small slips
// (missing keys, wrappers, fences, "true" as text) are fixed, not rejected.
import { z } from "zod";

/** Pull a readable string out of whatever the model put in a string slot. */
export function asText(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["text", "content", "value", "title", "item", "description", "body"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
    const firstStr = Object.values(o).find((x) => typeof x === "string");
    if (typeof firstStr === "string") return firstStr;
  }
  return "";
}

function unwrapOptional(s: z.ZodTypeAny): z.ZodTypeAny {
  let cur: z.ZodTypeAny = s;
  while (cur instanceof z.ZodOptional || cur instanceof z.ZodNullable) cur = cur.unwrap();
  return cur;
}

/** Repair common near-misses (missing keys, string for list, objects for strings, wrappers). */
export function coerce(schema: z.ZodTypeAny, v: unknown): unknown {
  const s = unwrapOptional(schema);
  if (s instanceof z.ZodString) return asText(v);
  if (s instanceof z.ZodBoolean) {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return /^\s*(true|yes|1)\s*$/i.test(v);
    return Boolean(v);
  }
  if (s instanceof z.ZodArray) {
    const el = s.element as z.ZodTypeAny;
    const arr = Array.isArray(v)
      ? v
      : v == null || v === ""
        ? []
        : typeof v === "string"
          ? v
              .split(/\n+/)
              .map((x) => x.replace(/^\s*[-*•\d.)]+\s*/, ""))
              .filter(Boolean)
          : [v];
    return arr.map((x) => coerce(el, x));
  }
  if (s instanceof z.ZodObject) {
    const shape = s.shape as Record<string, z.ZodTypeAny>;
    const keys = Object.keys(shape);
    if (Array.isArray(v)) {
      const arrKey = keys.find((k) => unwrapOptional(shape[k]!) instanceof z.ZodArray);
      v = arrKey ? { [arrKey]: v } : {};
    }
    let o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
    if (!keys.some((k) => k in o)) {
      const inner = Object.values(o).find(
        (x) =>
          x && typeof x === "object" && !Array.isArray(x) && keys.some((k) => k in (x as object)),
      );
      if (inner) o = inner as Record<string, unknown>;
    }
    if (typeof v === "string") {
      // A bare string goes into `text` if present, else the first string field.
      const k =
        (keys.includes("text") && "text") ||
        keys.find((kk) => unwrapOptional(shape[kk]!) instanceof z.ZodString);
      if (k) o = { [k]: v };
    }
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const field = shape[k]!;
      const isOptional = field.isOptional() || field.isNullable();
      if (o[k] == null && isOptional) out[k] = null;
      else out[k] = coerce(field, o[k]);
    }
    return out;
  }
  return v;
}

export function parseLenient<T>(schema: z.ZodType<T>, raw: unknown): T | null {
  const direct = schema.safeParse(raw);
  if (direct.success) return direct.data;
  const fixed = schema.safeParse(coerce(schema as unknown as z.ZodTypeAny, raw));
  return fixed.success ? fixed.data : null;
}

export function parseFallback<T>(
  schema: z.ZodType<T>,
  text: string | undefined,
  tag = "ai-json",
): T | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const ob = cleaned.indexOf("{");
  const ab = cleaned.indexOf("[");
  const isArray = ab !== -1 && (ob === -1 || ab < ob);
  const start = isArray ? ab : ob;
  const end = cleaned.lastIndexOf(isArray ? "]" : "}");
  if (start === -1 || end <= start) return null;
  try {
    const res = parseLenient(schema, JSON.parse(cleaned.slice(start, end + 1)));
    if (!res) console.warn(`[${tag}] lenient parse rejected draft`);
    return res;
  } catch (err) {
    console.warn(`[${tag}] draft JSON unreadable:`, (err as Error).message);
    return null;
  }
}

/** One-line diagnostic for a failed structured-output attempt. */
export function logDraftFailure(tag: string, attempt: number, err: unknown): void {
  const e = err as { text?: string; finishReason?: string; cause?: unknown; message?: string };
  const cause = e?.cause;
  console.warn(
    `[${tag}] draft attempt failed`,
    attempt,
    e?.message,
    "| finish:",
    e?.finishReason,
    "| textLen:",
    e?.text?.length,
    "| head:",
    e?.text?.slice(0, 400),
    "| tail:",
    e?.text?.slice(-400),
    "| cause:",
    cause instanceof Error ? cause.message.slice(0, 600) : String(cause).slice(0, 600),
  );
}
