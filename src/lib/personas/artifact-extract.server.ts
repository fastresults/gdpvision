// Chamber 07 · Artefact extraction — server-only.
//
// One door for turning an uploaded file into readable text, whatever it is:
// a spreadsheet of survey returns, a scanned paper form, a PDF of a moderator's
// notes, or an audio recording of a focus group. The fieldwork ingest pipeline
// depends on this being boring and predictable.

export type ArtifactKind = "text" | "tabular" | "image" | "audio" | "document";

export interface ExtractedArtifact {
  kind: ArtifactKind;
  /** Readable text — CSV/TSV verbatim for tabular files, transcript for audio. */
  text: string;
  filename: string;
  mime: string;
}

const TABULAR_EXT = /\.(csv|tsv|txt)$/i;

async function callGateway(body: unknown): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Lovable AI Gateway not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI rate limit — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content?.trim() ?? "";
}

async function transcribe(buf: Buffer, mime: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Lovable AI Gateway not configured");
  const extMap: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/m4a": "m4a",
  };
  const ext = extMap[mime.split(";")[0] ?? ""] ?? "webm";
  const form = new FormData();
  form.append("model", "openai/gpt-4o-mini-transcribe");
  form.append("file", new Blob([new Uint8Array(buf)], { type: mime }), `session.${ext}`);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
  const j = (await res.json()) as { text?: string };
  return j.text ?? "";
}

/** Read a file already sitting in the study-artifacts bucket into plain text. */
export async function extractArtifact(
  file: Blob,
  mime: string,
  filename: string,
): Promise<ExtractedArtifact> {
  const kindHint = (mime || "").toLowerCase();

  if (
    kindHint.startsWith("text/") ||
    kindHint.includes("json") ||
    kindHint.includes("csv") ||
    kindHint.includes("markdown") ||
    TABULAR_EXT.test(filename)
  ) {
    const text = await file.text();
    const looksTabular =
      /\.(csv|tsv)$/i.test(filename) || kindHint.includes("csv") || /,|\t/.test(text.slice(0, 400));
    return {
      kind: looksTabular ? "tabular" : "text",
      text: text.slice(0, 400_000),
      filename,
      mime: kindHint,
    };
  }

  if (kindHint.startsWith("image/")) {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const text = await callGateway({
      model: "google/gemini-2.5-flash",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "You read completed research forms. Transcribe every visible field label and the answer written against it, verbatim, preserving order. If several respondents appear, separate them with a line reading ---RESPONDENT---.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this completed form." },
            { type: "image_url", image_url: { url: `data:${kindHint};base64,${base64}` } },
          ],
        },
      ],
    });
    return { kind: "image", text, filename, mime: kindHint };
  }

  if (kindHint.startsWith("audio/") || kindHint.startsWith("video/")) {
    const buf = Buffer.from(await file.arrayBuffer());
    const text = await transcribe(buf, kindHint);
    return { kind: "audio", text, filename, mime: kindHint };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");
  const text = await callGateway({
    model: "google/gemini-2.5-pro",
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "Extract the full readable content of the attached document. If it contains a table of survey returns, reproduce it as CSV with the header row first. Otherwise return plain text preserving headings and speaker labels.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Extract: ${filename}` },
          {
            type: "file",
            file: { filename, file_data: `data:${kindHint || "application/pdf"};base64,${base64}` },
          },
        ],
      },
    ],
  });
  const looksTabular = /^[^\n]*,[^\n]*\n[^\n]*,/.test(text.trim());
  return { kind: looksTabular ? "tabular" : "document", text, filename, mime: kindHint };
}
