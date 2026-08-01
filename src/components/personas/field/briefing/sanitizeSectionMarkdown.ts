/**
 * Strips the retired "Your question, in your words" verbatim-quotation block
 * from stored briefing markdown so documents composed before it was removed
 * render the same as freshly composed ones.
 */
export function sanitizeSectionMarkdown(md: string): string {
  if (!md) return md;
  const lines = md.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const heading = /^#{1,6}\s+(.*)$/.exec(line.trim());
    if (heading) {
      skipping = /your question,?\s+in your words/i.test(heading[1] ?? "");
      if (skipping) continue;
    }
    if (skipping) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
