// @domain indices
// @tables none
// @ui none
//
// Pure acceptance rule for AI-drafted evidence: a cited https source, a quote,
// a 4-digit period and a value inside a plausible range for the indicator.

export type DraftItem = {
  country: string;
  value: number | null;
  period: string | null;
  document_title: string | null;
  document_url: string | null;
  document_date?: string | null;
  publisher: string | null;
  quote: string | null;
};

export function validDraft(it: DraftItem, best: number, worst: number): boolean {
  if (it.value == null || !Number.isFinite(it.value)) return false;
  if (!it.period || !/^\d{4}$/.test(it.period)) return false;
  if (!it.document_url || !/^https:\/\/[^\s]+\.[^\s]+/.test(it.document_url)) return false;
  if (!it.quote || it.quote.trim().length < 8) return false;
  if (!it.document_title || it.document_title.trim().length < 3) return false;
  if (!it.publisher || it.publisher.trim().length < 2) return false;
  const lo = Math.min(best, worst);
  const hi = Math.max(best, worst);
  const span = hi - lo || 1;
  // allow values beyond the goalposts (they clip in scoring) but reject absurd ones
  return it.value >= lo - 3 * span && it.value <= hi + 3 * span;
}
