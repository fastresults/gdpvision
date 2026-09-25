// The brand tokens as swatches and a contrast report. Colour is shown as
// borders and small marks on a light surface, which is also the rule the
// tokens enforce.

import { Explain } from "@/components/explain/Explain";
import type { BrandTokens } from "@/lib/egov/brand";
import { cn } from "@/lib/utils";

import { MICRO } from "./labels";

function Swatch({ hex, label, role }: { hex: string; label: string; role?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="h-8 w-8 shrink-0 border-2 bg-paper-0"
        style={{ borderColor: hex }}
      />
      <div className="min-w-0">
        <div className="text-sm text-ink-950">{label}</div>
        <div className="font-mono text-[11px] text-ink-500">
          {hex}
          {role ? ` · ${role}` : ""}
        </div>
      </div>
    </div>
  );
}

export function BrandPreview({ brand }: { brand: BrandTokens }) {
  return (
    <div>
      <div className={MICRO}>Brand tokens · {brand.country_code}</div>
      <p className="mt-1 max-w-2xl text-sm text-ink-700">
        Derived from the national flag under the house rules: light surfaces, colour in borders and
        accents only, one accent, and type set in the ink colour.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Swatch hex={brand.ink} label="Ink" role="text" />
        <Swatch hex={brand.accent} label="Accent" role="rules, marks, active states" />
        {brand.borders.map((b, i) => (
          <Swatch key={b} hex={b} label={`Border ${i + 1}`} role="structural borders" />
        ))}
      </div>

      <div className="mt-6 border-t border-line-200 pt-4">
        <div className={MICRO}>Sample</div>
        <div
          className="mt-3 border-l-4 bg-paper-0 p-5"
          style={{ borderColor: brand.borders[0] ?? brand.accent }}
        >
          <div
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: brand.ink }}
          >
            Government of {brand.country_code}
          </div>
          <div className="mt-2 font-display text-2xl" style={{ color: brand.ink }}>
            Apply for a business licence
          </div>
          <div aria-hidden className="mt-3 w-12 border-t-2" style={{ borderColor: brand.accent }} />
          <p className="mt-3 text-sm" style={{ color: brand.ink }}>
            Complete the application online, pay the fee, and receive the licence by email.
          </p>
          <div
            className="mt-4 inline-block border px-3 py-1.5 text-sm"
            style={{ borderColor: brand.ink, color: brand.ink }}
          >
            Start
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-line-200 pt-4">
        <div className={MICRO}>Contrast on paper</div>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {brand.contrast.map((c) => (
              <tr key={c.role} className="border-b border-line-200">
                <td className="py-1.5 pr-3 text-ink-950">{c.role}</td>
                <td className="py-1.5 pr-3 font-mono text-xs text-ink-500">{c.hex}</td>
                <td className="py-1.5 pr-3 text-right font-mono text-xs tabular-nums">
                  <Explain
                    id="egov.brand.contrast"
                    ctx={{ role: c.role, hex: c.hex, ratio: c.ratio }}
                  >
                    {c.ratio}:1
                  </Explain>
                </td>
                <td
                  className={cn(
                    "py-1.5 text-xs",
                    c.aa_text
                      ? "text-signal-positive"
                      : c.aa_large
                        ? "text-signal-caution"
                        : "text-ink-500",
                  )}
                >
                  {c.aa_text ? "AA text" : c.aa_large ? "AA large type" : "not for text"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 border-t border-line-200 pt-4">
        <div className={MICRO}>Flag</div>
        <ul className="mt-2 flex flex-wrap gap-3">
          {brand.flag.map((c) => (
            <li key={c.hex + c.name} className="flex items-center gap-2 text-xs text-ink-700">
              <span
                aria-hidden
                className="h-4 w-4 border-2 bg-paper-0"
                style={{ borderColor: c.hex }}
              />
              {c.name} <span className="font-mono text-ink-500">{c.hex}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 border-t border-line-200 pt-4">
        <div className={MICRO}>Rules</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-700">
          {brand.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}
