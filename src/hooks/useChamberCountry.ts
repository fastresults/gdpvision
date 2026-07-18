import { useRouterState } from "@tanstack/react-router";

type Binding = { country_code: string; is_default?: boolean | null };

/**
 * Resolve the "current country" for a chamber landing page.
 *
 * Precedence:
 *   1. `?code=XXX` URL search param (set by the ChambersLauncher so the
 *      selected country follows the admin into every chamber).
 *   2. The admin's default binding.
 *   3. The first binding on record.
 *   4. `"LCA"` as a last-resort fallback (should never actually hit in prod).
 */
export function useChamberCountry(bindings: readonly Binding[] | undefined | null): string {
  const search = useRouterState({ select: (s) => s.location.search as { code?: unknown } });
  const fromUrl = typeof search?.code === "string" ? search.code.toUpperCase() : undefined;
  if (fromUrl && /^[A-Z]{2,4}$/.test(fromUrl)) return fromUrl;
  const list = bindings ?? [];
  return list.find((b) => b.is_default)?.country_code ?? list[0]?.country_code ?? "LCA";
}
