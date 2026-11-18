import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./helpers/contrast";

const PUBLISHED_TOLERANCE = 0.1;
const TEXT_MIN = 4.5;
const CONTROL_MIN = 3;
const NUM_RUNS = 100;

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const rootBlock = /:root\s*{([\s\S]*?)\n}/.exec(css)?.[1] ?? "";

const rawTokens = new Map<string, string>();
for (const match of rootBlock.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gi)) {
  rawTokens.set(match[1], match[2].trim());
}

function token(name: string): string {
  let value = rawTokens.get(name);
  const seen = new Set<string>();
  while (value !== undefined && value.startsWith("var(")) {
    const ref = /^var\((--[a-z0-9-]+)\)$/i.exec(value)?.[1];
    if (!ref || seen.has(ref)) throw new Error(`Cannot resolve ${name}`);
    seen.add(ref);
    value = rawTokens.get(ref);
  }
  if (value === undefined) throw new Error(`Token ${name} not found in globals.css`);
  return value;
}

type Pair = { fg: string; bg: string; published: number };

const SURFACES = ["--surface-void", "--surface-card", "--surface-raised", "--surface-overlay"];

// Published values from .kiro/steering/design-system.md (Text table).
const TEXT_PAIRS: Pair[] = [
  { fg: "--text-primary", bg: "--surface-void", published: 18.7 },
  { fg: "--text-primary", bg: "--surface-card", published: 17.0 },
  { fg: "--text-primary", bg: "--surface-raised", published: 15.3 },
  { fg: "--text-primary", bg: "--surface-overlay", published: 13.3 },
  { fg: "--text-secondary", bg: "--surface-void", published: 7.8 },
  { fg: "--text-secondary", bg: "--surface-card", published: 7.1 },
  { fg: "--text-secondary", bg: "--surface-raised", published: 6.4 },
  { fg: "--text-secondary", bg: "--surface-overlay", published: 5.6 },
  { fg: "--text-tertiary", bg: "--surface-void", published: 6.0 },
  { fg: "--text-tertiary", bg: "--surface-card", published: 5.5 },
  { fg: "--text-tertiary", bg: "--surface-raised", published: 4.9 },
];

const TERTIARY_ON_OVERLAY_PUBLISHED = 4.3;

const ACCENT_PAIRS: Pair[] = [
  { fg: "--accent-candle", bg: "--surface-card", published: 10.4 },
  { fg: "--accent-ecto", bg: "--surface-card", published: 10.3 },
  { fg: "--accent-blood", bg: "--surface-card", published: 6.6 },
  { fg: "--accent-ghost", bg: "--surface-card", published: 8.2 },
  { fg: "--accent-spirit", bg: "--surface-card", published: 8.0 },
];

// Text and icons on a solid accent fill always use --on-accent (= --surface-void).
const ACCENT_FILLS = [
  "--accent-candle",
  "--accent-ecto",
  "--accent-blood",
  "--accent-ghost",
  "--accent-spirit",
] as const;

const BUTTON_PAIRS: Pair[] = [
  { fg: "--surface-void", bg: "--text-primary", published: 18.7 },
  { fg: "--surface-void", bg: "--accent-blood", published: 7.3 },
];

function ratio(pair: Pair): number {
  return contrastRatio(token(pair.fg), token(pair.bg));
}

function label(pair: Pair): string {
  return `${pair.fg} on ${pair.bg}`;
}

describe("contrast of the Token_Sheet colors", () => {
  describe.each([
    ["text tokens on their surfaces", TEXT_PAIRS, TEXT_MIN],
    ["accent tokens on the card surface", ACCENT_PAIRS, TEXT_MIN],
    ["void text on primary and danger button backgrounds", BUTTON_PAIRS, TEXT_MIN],
  ] as const)("%s", (_name, pairs, minimum) => {
    it.each(pairs.map((pair) => [label(pair), pair] as const))(
      "%s meets the minimum ratio and matches the published value",
      (_label, pair) => {
        const computed = ratio(pair);
        expect(computed).toBeGreaterThanOrEqual(minimum);
        expect(Math.abs(computed - pair.published)).toBeLessThanOrEqual(PUBLISHED_TOLERANCE);
      },
    );
  });

  it.each(["--surface-void", "--surface-card", "--surface-raised"])(
    "border control reaches 3:1 on %s",
    (surface) => {
      expect(contrastRatio(token("--border-control"), token(surface))).toBeGreaterThanOrEqual(
        CONTROL_MIN,
      );
    },
  );

  it.each(SURFACES)("focus ring reaches 3:1 on %s", (surface) => {
    expect(contrastRatio(token("--focus-ring"), token(surface))).toBeGreaterThanOrEqual(
      CONTROL_MIN,
    );
  });

  it("done-state tertiary text on the card surface stays at or above 4.5:1", () => {
    expect(
      contrastRatio(token("--text-tertiary"), token("--surface-card")),
    ).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it("done-state ecto impact amount on the card surface stays at or above 4.5:1", () => {
    expect(contrastRatio(token("--accent-ecto"), token("--surface-card"))).toBeGreaterThanOrEqual(
      TEXT_MIN,
    );
  });

  it("tertiary text on the overlay surface is below 4.5:1 and matches its published value, so it must not be used", () => {
    const computed = contrastRatio(token("--text-tertiary"), token("--surface-overlay"));
    expect(computed).toBeLessThan(TEXT_MIN);
    expect(Math.abs(computed - TERTIARY_ON_OVERLAY_PUBLISHED)).toBeLessThanOrEqual(
      PUBLISHED_TOLERANCE,
    );
  });
});

// Light ink on an accent fill fails WCAG; these values document why --on-accent exists.
const INK_ON_ACCENT_PUBLISHED: Record<(typeof ACCENT_FILLS)[number], number> = {
  "--accent-candle": 1.6,
  "--accent-ecto": 1.7,
  "--accent-blood": 2.6,
  "--accent-ghost": 2.1,
  "--accent-spirit": 2.1,
};

const HEX_RADIX = 16;
const CHANNEL_MAX = 255;
const PERCENT = 100;

function hexChannels(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), HEX_RADIX);
  return [(value >> 16) & CHANNEL_MAX, (value >> 8) & CHANNEL_MAX, value & CHANNEL_MAX];
}

function toHex(channels: number[]): string {
  return `#${channels.map((c) => Math.round(c).toString(HEX_RADIX).padStart(2, "0")).join("")}`;
}

/**
 * Resolves a --tint-* token written as `color-mix(in srgb, var(--accent-x) N%, transparent)`
 * and composites it over `surface`, the way a browser paints a tinted badge on that surface.
 */
function tintOver(tintToken: string, surface: string): { accent: string; composite: string; alpha: number } {
  const value = rawTokens.get(tintToken) ?? "";
  const match = /^color-mix\(in srgb,\s*var\((--[a-z0-9-]+)\)\s+([\d.]+)%,\s*transparent\)$/i.exec(value);
  if (!match) throw new Error(`Unexpected ${tintToken} value: ${value}`);
  const accent = token(match[1]);
  const alpha = Number(match[2]) / PERCENT;
  const fg = hexChannels(accent);
  const bg = hexChannels(token(surface));
  return { accent, alpha, composite: toHex(fg.map((c, i) => c * alpha + bg[i] * (1 - alpha))) };
}

describe("content on accent fills", () => {
  it("defines --on-accent as the void surface", () => {
    expect(rawTokens.get("--on-accent")).toBe("var(--surface-void)");
  });

  it.each(ACCENT_FILLS)("on-accent text or icons on a solid %s fill reach 4.5:1", (fill) => {
    expect(contrastRatio(token("--on-accent"), token(fill))).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it.each(ACCENT_FILLS)("ink on a solid %s fill fails 4.5:1, so it must never be used", (fill) => {
    const computed = contrastRatio(token("--text-primary"), token(fill));
    expect(computed).toBeLessThan(TEXT_MIN);
    expect(Math.abs(computed - INK_ON_ACCENT_PUBLISHED[fill])).toBeLessThanOrEqual(PUBLISHED_TOLERANCE);
  });

  it.each(ACCENT_FILLS.map((fill) => fill.replace("--accent-", "")))(
    "%s text on its own 14-percent tint over the card surface reaches 4.5:1",
    (name) => {
      const { accent, alpha, composite } = tintOver(`--tint-${name}`, "--surface-card");
      expect(alpha).toBeCloseTo(0.14, 10);
      expect(contrastRatio(accent, composite)).toBeGreaterThanOrEqual(TEXT_MIN);
    },
  );
});

describe("contrastRatio properties", () => {
  const hexColor = fc
    .integer({ min: 0, max: 0xffffff })
    .map((n) => `#${n.toString(16).padStart(6, "0")}`);
  const tokenColor = fc.constantFrom(
    ...[...rawTokens.values()].filter((v) => /^#[0-9a-f]{6}$/i.test(v)),
  );

  it("is bounded in [1, 21], symmetric and reflexive for arbitrary and token colors", () => {
    // Feature: design-system-foundation, Property 14: Contrast ratio is bounded, symmetric and reflexive
    fc.assert(
      fc.property(fc.oneof(hexColor, tokenColor), fc.oneof(hexColor, tokenColor), (a, b) => {
        const ab = contrastRatio(a, b);
        expect(ab).toBeGreaterThanOrEqual(1);
        expect(ab).toBeLessThanOrEqual(21 + 1e-9);
        expect(ab).toBeCloseTo(contrastRatio(b, a), 12);
        expect(contrastRatio(a, a)).toBe(1);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("returns 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 10);
  });
});
