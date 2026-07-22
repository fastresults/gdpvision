// Orchestrates request-attachment uploads for the Country Console:
// signed URL → PUT to storage → parseUpload for AI text extraction.
// Each item carries its own status so the composer can render chips.

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signUploadUrl, parseUpload } from "@/lib/personas/parse-upload.functions";

export type UploadStatus = "uploading" | "reading" | "ready" | "failed";

export interface ConsoleUpload {
  id: string;
  name: string;
  size: number;
  mime: string;
  path?: string;
  excerpt?: string;
  status: UploadStatus;
  error?: string;
}

const MAX_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 5;

export function useConsoleUploads(countryCode: string) {
  const [files, setFiles] = useState<ConsoleUpload[]>([]);
  const idRef = useRef(0);

  const patch = useCallback((id: string, update: Partial<ConsoleUpload>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...update } : f)));
  }, []);

  const add = useCallback(
    async (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      const room = MAX_FILES - files.length;
      const accepted = incoming.slice(0, Math.max(0, room));

      for (const file of accepted) {
        if (file.size > MAX_SIZE) continue;
        const id = `u_${++idRef.current}`;
        const item: ConsoleUpload = {
          id,
          name: file.name,
          size: file.size,
          mime: file.type || "application/octet-stream",
          status: "uploading",
        };
        setFiles((prev) => [...prev, item]);

        try {
          const { path, signedUrl, token } = await signUploadUrl({
            data: { countryCode, filename: file.name },
          });
          const { error: upErr } = await supabase.storage
            .from("study-artifacts")
            .uploadToSignedUrl(path, token, file, { contentType: file.type });
          if (upErr && signedUrl) {
            await fetch(signedUrl, {
              method: "PUT",
              body: file,
              headers: { "Content-Type": file.type || "application/octet-stream" },
            });
          }
          patch(id, { path, status: "reading" });
          try {
            const { excerpt } = await parseUpload({
              data: { path, mimeType: file.type || "application/octet-stream", countryCode },
            });
            patch(id, { excerpt, status: "ready" });
          } catch (e) {
            // Parsing is best-effort. The file is uploaded and the agency can still open it.
            patch(id, { status: "ready", error: (e as Error).message });
          }
        } catch (e) {
          patch(id, { status: "failed", error: (e as Error).message });
        }
      }
    },
    [countryCode, files.length, patch],
  );

  const remove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const reset = useCallback(() => setFiles([]), []);

  const ready = files.every((f) => f.status === "ready" || f.status === "failed");
  const anyReadable = files.some((f) => f.status === "ready");

  return { files, add, remove, reset, ready, anyReadable, capacity: MAX_FILES - files.length };
}
