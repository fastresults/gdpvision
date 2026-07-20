// Chamber 07 · Wizard uploads — signed URL for direct browser upload +
// text extraction for AI grounding. Files land under study-artifacts/<COUNTRY>/…
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SignInput = z.object({
  countryCode: z.string().min(2).max(4),
  filename: z.string().min(1).max(200),
});

function safePath(country: string, filename: string) {
  const clean = filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  const stamp = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${country}/${stamp}-${rnd}-${clean}`;
}

export const signUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SignInput.parse(d))
  .handler(async ({ data, context }) => {
    const path = safePath(data.countryCode, data.filename);
    const { data: signed, error } = await context.supabase.storage
      .from("study-artifacts")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

const ParseInput = z.object({
  path: z.string(),
  mimeType: z.string().default("application/octet-stream"),
  countryCode: z.string(),
});

export const parseUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ParseInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: file, error } = await context.supabase.storage
      .from("study-artifacts")
      .download(data.path);
    if (error || !file) throw new Error(error?.message ?? "Download failed");
    const kind = data.mimeType.toLowerCase();

    // Plain text / markdown / json → decode directly
    if (kind.startsWith("text/") || kind.includes("json") || kind.includes("markdown")) {
      const text = await file.text();
      return { excerpt: text.slice(0, 8000), kind: "text" as const };
    }

    // Image → OCR via Gemini vision
    if (kind.startsWith("image/")) {
      const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      const text = await visionExtract(base64, kind);
      return { excerpt: text.slice(0, 8000), kind: "image" as const };
    }

    // Audio → transcribe
    if (kind.startsWith("audio/")) {
      const buf = Buffer.from(await file.arrayBuffer());
      const text = await transcribeBuffer(buf, kind);
      return { excerpt: text.slice(0, 8000), kind: "audio" as const };
    }

    // PDF / DOCX / other docs → send as file part to Gemini for text extraction
    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");
    const text = await documentExtract(base64, kind || "application/pdf", data.path.split("/").pop() ?? "file.pdf");
    return { excerpt: text.slice(0, 8000), kind: "document" as const };
  });

async function callGateway(body: unknown): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Lovable AI Gateway not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AI Gateway ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content?.trim() ?? "";
}

async function visionExtract(base64: string, mime: string) {
  return callGateway({
    model: "google/gemini-2.5-flash",
    temperature: 0.1,
    messages: [
      { role: "system", content: "Transcribe and describe the image faithfully. Extract every visible text verbatim." },
      { role: "user", content: [
        { type: "text", text: "Extract all text and describe key visuals." },
        { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
      ] },
    ],
  });
}

async function documentExtract(base64: string, mime: string, filename: string) {
  return callGateway({
    model: "google/gemini-2.5-pro",
    temperature: 0.1,
    messages: [
      { role: "system", content: "Extract the full readable text of the attached document. Preserve section headings. Return plain text only." },
      { role: "user", content: [
        { type: "text", text: `Extract text from: ${filename}` },
        { type: "file", file: { filename, file_data: `data:${mime};base64,${base64}` } },
      ] },
    ],
  });
}

async function transcribeBuffer(buf: Buffer, mime: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Lovable AI Gateway not configured");
  const extMap: Record<string, string> = { "audio/webm": "webm", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav" };
  const ext = extMap[mime.split(";")[0] ?? ""] ?? "webm";
  const form = new FormData();
  form.append("model", "openai/gpt-4o-mini-transcribe");
  form.append("file", new Blob([new Uint8Array(buf)], { type: mime }), `upload.${ext}`);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription ${res.status}`);
  const j = (await res.json()) as { text?: string };
  return j.text ?? "";
}
