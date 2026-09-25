// Brand tokens for a country's e-government platform, derived from the
// national flag and the house rules: light surfaces, colour in borders and
// accents only, black (or the flag's darkest colour) for type, one accent,
// never reversed-out text on a dark fill. Pure: no I/O.
//
// Flag colours are the commonly published values; a country may override
// them in the PRD's scope. Contrast follows WCAG 2.1 (relative luminance).

export interface FlagColour {
  name: string;
  hex: string;
}

export interface BrandTokens {
  country_code: string;
  /** Text colour. */
  ink: string;
  /** Page surface. Always light. */
  paper: string;
  /** The single accent: rules, marks, active states. Never a text colour. */
  accent: string;
  /** Structural border colours, strongest first. */
  borders: string[];
  /** Every flag colour, for reference. */
  flag: FlagColour[];
  typography: { display: string; body: string; mono: string };
  rules: string[];
  /** Contrast of each colour used as text on the paper surface. */
  contrast: Array<{
    role: string;
    hex: string;
    ratio: number;
    aa_text: boolean;
    aa_large: boolean;
  }>;
}

const FLAGS: Record<string, FlagColour[]> = {
  ATG: [
    { name: "Red", hex: "#CE1126" },
    { name: "Black", hex: "#000000" },
    { name: "Blue", hex: "#0072C6" },
    { name: "White", hex: "#FFFFFF" },
    { name: "Gold (sun)", hex: "#FCD116" },
  ],
  KNA: [
    { name: "Green", hex: "#009E49" },
    { name: "Gold", hex: "#FCD116" },
    { name: "Black", hex: "#000000" },
    { name: "Red", hex: "#CE1126" },
    { name: "White", hex: "#FFFFFF" },
  ],
  GRD: [
    { name: "Red", hex: "#CE1126" },
    { name: "Gold", hex: "#FCD116" },
    { name: "Green", hex: "#007A5E" },
  ],
  DMA: [
    { name: "Green", hex: "#006B3F" },
    { name: "Gold", hex: "#FCD116" },
    { name: "Black", hex: "#000000" },
    { name: "White", hex: "#FFFFFF" },
    { name: "Red", hex: "#D41C30" },
  ],
  LCA: [
    { name: "Cerulean blue", hex: "#66CCFF" },
    { name: "Gold", hex: "#FCD116" },
    { name: "Black", hex: "#000000" },
    { name: "White", hex: "#FFFFFF" },
  ],
  VCT: [
    { name: "Blue", hex: "#0072C6" },
    { name: "Gold", hex: "#FCD116" },
    { name: "Green", hex: "#009E60" },
  ],
  BRB: [
    { name: "Ultramarine", hex: "#00267F" },
    { name: "Gold", hex: "#FFC726" },
    { name: "Black", hex: "#000000" },
  ],
  JAM: [
    { name: "Green", hex: "#009B3A" },
    { name: "Gold", hex: "#FED100" },
    { name: "Black", hex: "#000000" },
  ],
  TTO: [
    { name: "Red", hex: "#CE1126" },
    { name: "White", hex: "#FFFFFF" },
    { name: "Black", hex: "#000000" },
  ],
  GUY: [
    { name: "Green", hex: "#009E49" },
    { name: "Gold", hex: "#FCD116" },
    { name: "Red", hex: "#CE1126" },
    { name: "Black", hex: "#000000" },
    { name: "White", hex: "#FFFFFF" },
  ],
  BHS: [
    { name: "Aquamarine", hex: "#00778B" },
    { name: "Gold", hex: "#FFC72C" },
    { name: "Black", hex: "#000000" },
  ],
  BLZ: [
    { name: "Blue", hex: "#003F87" },
    { name: "Red", hex: "#CE1126" },
    { name: "White", hex: "#FFFFFF" },
  ],
  SUR: [
    { name: "Green", hex: "#377E3F" },
    { name: "White", hex: "#FFFFFF" },
    { name: "Red", hex: "#B40A2D" },
    { name: "Gold", hex: "#ECC81D" },
  ],
  HTI: [
    { name: "Blue", hex: "#00209F" },
    { name: "Red", hex: "#D21034" },
    { name: "White", hex: "#FFFFFF" },
  ],
};

const FALLBACK: FlagColour[] = [
  { name: "Ink", hex: "#111111" },
  { name: "Gold", hex: "#B98A2F" },
  { name: "Blue", hex: "#1E3350" },
  { name: "White", hex: "#FFFFFF" },
];

export const HOUSE_RULES = [
  "Light surfaces only: white or near-white page backgrounds throughout.",
  "Colour lives in borders, rules and accents, never as a solid fill behind text.",
  "No reversed-out white type on dark fills.",
  "One accent colour for marks, rules and active states; it is never a text colour.",
  "Type is set in the ink colour; secondary text is a tint of it, not a flag colour.",
  "Every text-on-surface pair meets WCAG AA (4.5:1, or 3:1 for large type).",
  "Illustrations are monochrome engraved marginalia, one per section, never full-bleed.",
] as const;

// ------------------------------------------------------------------ colour maths

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG 2.1 relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

function isWhite(hex: string): boolean {
  return luminance(hex) > 0.9;
}

function isGold(c: FlagColour): boolean {
  return /gold|yellow|sun/i.test(c.name);
}

// ------------------------------------------------------------------ tokens

export function flagColours(code: string): FlagColour[] {
  return FLAGS[code.toUpperCase()] ?? FALLBACK;
}

export function hasFlagPalette(code: string): boolean {
  return code.toUpperCase() in FLAGS;
}

export function buildBrandTokens(code: string, override?: FlagColour[]): BrandTokens {
  const flag = override && override.length > 0 ? override : flagColours(code);
  const chromatic = flag.filter((c) => !isWhite(c.hex));

  const ink =
    chromatic.find((c) => /black/i.test(c.name))?.hex ??
    [...chromatic].sort((a, b) => luminance(a.hex) - luminance(b.hex))[0]?.hex ??
    "#111111";

  const gold = chromatic.find(isGold);
  const nonInk = chromatic.filter((c) => c.hex !== ink);
  const accent =
    gold?.hex ??
    [...nonInk].sort((a, b) => luminance(b.hex) - luminance(a.hex))[0]?.hex ??
    "#B98A2F";

  const borders = nonInk
    .filter((c) => c.hex !== accent)
    .sort((a, b) => luminance(a.hex) - luminance(b.hex))
    .map((c) => c.hex);

  const paper = "#FFFFFF";
  const roles: Array<{ role: string; hex: string }> = [
    { role: "Ink on paper", hex: ink },
    { role: "Accent on paper (not for text)", hex: accent },
    ...borders.map((hex, i) => ({ role: `Border ${i + 1} on paper (not for text)`, hex })),
  ];
  const contrast = roles.map((r) => {
    const ratio = contrastRatio(r.hex, paper);
    return { ...r, ratio, aa_text: ratio >= 4.5, aa_large: ratio >= 3 };
  });

  return {
    country_code: code.toUpperCase(),
    ink,
    paper,
    accent,
    borders,
    flag,
    typography: {
      display: "A serif display face for headings (the platform's own choice).",
      body: "A humanist sans for body text at 16px minimum.",
      mono: "A monospace face for reference numbers, dates and labels.",
    },
    rules: [...HOUSE_RULES],
    contrast,
  };
}

/** Lines the brand stage feeds the model, and the provenance rail shows. */
export function brandContextLines(t: BrandTokens): string[] {
  return [
    `Ink (text): ${t.ink}`,
    `Paper (surface): ${t.paper}`,
    `Accent (rules, marks, active states; never text): ${t.accent}`,
    ...t.borders.map((b, i) => `Border ${i + 1}: ${b}`),
    `Flag colours: ${t.flag.map((c) => `${c.name} ${c.hex}`).join(", ")}`,
    ...t.contrast.map(
      (c) =>
        `Contrast ${c.role}: ${c.ratio}:1 — ${c.aa_text ? "AA text" : c.aa_large ? "AA large type only" : "fails AA"}`,
    ),
    ...t.rules.map((r) => `Rule: ${r}`),
  ];
}
