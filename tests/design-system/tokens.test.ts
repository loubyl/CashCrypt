import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as motion from "@/components/ui/motionTokens";

const ROOT_DIR = resolve(__dirname, "../..");
const css = readFileSync(resolve(ROOT_DIR, "src/app/globals.css"), "utf8");
const layout = readFileSync(resolve(ROOT_DIR, "src/app/layout.tsx"), "utf8");

const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/g;

function normalize(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Returns the body of the first block that starts with `opener` (balanced braces). */
function extractBlock(source: string, opener: string): string {
  const start = source.indexOf(opener);
  if (start === -1) {
    throw new Error(`Block not found: ${opener}`);
  }
  let depth = 0;
  const bodyStart = source.indexOf("{", start) + 1;
  for (let i = bodyStart - 1; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart, i);
    }
  }
  throw new Error(`Unbalanced block: ${opener}`);
}

function parseDeclarations(block: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of block.matchAll(DECLARATION)) {
    map.set(match[1], normalize(match[2]));
  }
  return map;
}

const cleanCss = stripComments(css);
const rootBlock = extractBlock(cleanCss, ":root {");
const rootTokens = parseDeclarations(rootBlock);
const themeTokens = parseDeclarations(extractBlock(cleanCss, "@theme inline"));
const desktopRootTokens = parseDeclarations(
  extractBlock(extractBlock(cleanCss, "@media (min-width: 1024px)"), ":root"),
);

function expectTokens(
  tokens: Map<string, string>,
  expected: Record<string, string>,
): void {
  for (const [name, value] of Object.entries(expected)) {
    expect(tokens.get(name), name).toBe(value);
  }
}

describe("root color tokens", () => {
  it("defines the surface and divider hex values", () => {
    expectTokens(rootTokens, {
      "--surface-void": "#08080a",
      "--surface-card": "#151518",
      "--surface-raised": "#1f1f23",
      "--surface-overlay": "#2a2a2f",
      "--divider": "#232328",
    });
  });

  it("defines the text hex values", () => {
    expectTokens(rootTokens, {
      "--text-primary": "#f7f7f8",
      "--text-secondary": "#a1a1aa",
      "--text-tertiary": "#8c8c96",
    });
  });

  it("defines the control border and makes the focus ring equal candle", () => {
    expectTokens(rootTokens, {
      "--border-control": "#6b6b75",
      "--focus-ring": "var(--accent-candle)",
    });
    expect(rootTokens.get("--accent-candle")).toBe("#ffb547");
  });

  it("defines the accent hex values", () => {
    expectTokens(rootTokens, {
      "--accent-candle": "#ffb547",
      "--accent-ecto": "#3ddc97",
      "--accent-blood": "#ff6b78",
      "--accent-ghost": "#7ab0ff",
      "--accent-spirit": "#b69cff",
    });
  });

  it("maps semantic aliases to their accents", () => {
    expectTokens(rootTokens, {
      "--color-success": "var(--accent-ecto)",
      "--color-warning": "var(--accent-candle)",
      "--color-danger": "var(--accent-blood)",
      "--color-info": "var(--accent-ghost)",
    });
  });

  it("defines on-accent as the void surface and exposes it as text-on-accent", () => {
    expect(rootTokens.get("--on-accent")).toBe("var(--surface-void)");
    expect(themeTokens.get("--color-on-accent")).toBe("var(--on-accent)");
  });

  it("defines each tinted variant as its accent at 14% alpha", () => {
    for (const name of ["candle", "ecto", "blood", "ghost", "spirit"]) {
      expect(rootTokens.get(`--tint-${name}`), name).toBe(
        `color-mix(in srgb, var(--accent-${name}) 14%, transparent)`,
      );
    }
  });

  it("orders the data visualization palette candle, ecto, ghost, spirit, blood, gray", () => {
    expectTokens(rootTokens, {
      "--dataviz-1": "var(--accent-candle)",
      "--dataviz-2": "var(--accent-ecto)",
      "--dataviz-3": "var(--accent-ghost)",
      "--dataviz-4": "var(--accent-spirit)",
      "--dataviz-5": "var(--accent-blood)",
      "--dataviz-6": "#a1a1aa",
    });
  });

  it("defines the light score gradient as blood, candle, ecto", () => {
    expect(rootTokens.get("--light-score-gradient")).toBe(
      "linear-gradient(to right, var(--accent-blood), var(--accent-candle), var(--accent-ecto))",
    );
  });
});

describe("root motion and layout tokens", () => {
  it("defines the durations, press scale and reduced-motion fade ceiling", () => {
    expectTokens(rootTokens, {
      "--duration-press": "120ms",
      "--duration-tab": "200ms",
      "--duration-sheet": "280ms",
      "--duration-count": "600ms",
      "--duration-shimmer": "1600ms",
      "--duration-reduced-fade-max": "150ms",
      "--press-scale": "0.97",
    });
  });

  it("defines page, card and gap spacing with a wider page padding on desktop", () => {
    expectTokens(rootTokens, {
      "--page-padding": "16px",
      "--card-padding": "20px",
      "--card-gap": "12px",
      "--content-width": "560px",
    });
    expect(desktopRootTokens.get("--page-padding")).toBe("24px");
  });

  it("defines the shimmer keyframes and disables the shimmer under reduced motion", () => {
    expect(cleanCss).toMatch(/@keyframes shimmer\s*{/);
    const reduced = extractBlock(
      cleanCss,
      "@media (prefers-reduced-motion: reduce)",
    );
    expect(normalize(reduced)).toContain(".animate-shimmer { animation: none; }");
    expect(themeTokens.get("--animate-shimmer")).toBe(
      "shimmer var(--duration-shimmer) linear infinite",
    );
  });
});

describe("theme tokens", () => {
  it("references the matching CSS variable for every Color_Utility_Map entry", () => {
    const colorMap: Record<string, string> = {
      "--color-ink": "var(--text-primary)",
      "--color-ink-secondary": "var(--text-secondary)",
      "--color-ink-tertiary": "var(--text-tertiary)",
      "--color-surface-void": "var(--surface-void)",
      "--color-surface-card": "var(--surface-card)",
      "--color-surface-raised": "var(--surface-raised)",
      "--color-surface-overlay": "var(--surface-overlay)",
      "--color-candle": "var(--accent-candle)",
      "--color-ecto": "var(--accent-ecto)",
      "--color-blood": "var(--accent-blood)",
      "--color-ghost": "var(--accent-ghost)",
      "--color-spirit": "var(--accent-spirit)",
      "--color-control": "var(--border-control)",
      "--color-focus": "var(--focus-ring)",
      "--color-divider": "var(--divider)",
      "--color-candle-tint": "var(--tint-candle)",
      "--color-ecto-tint": "var(--tint-ecto)",
      "--color-blood-tint": "var(--tint-blood)",
      "--color-ghost-tint": "var(--tint-ghost)",
      "--color-spirit-tint": "var(--tint-spirit)",
      "--color-scrim": "var(--scrim)",
    };
    expectTokens(themeTokens, colorMap);
  });

  it("defines the pill, large, medium and circle radii", () => {
    expectTokens(themeTokens, {
      "--radius-pill": "999px",
      "--radius-lg": "24px",
      "--radius-md": "16px",
      "--radius-circle": "50%",
    });
  });

  it("uses a 4px spacing base and exposes page, card and gap spacing", () => {
    expectTokens(themeTokens, {
      "--spacing": "4px",
      "--spacing-page": "var(--page-padding)",
      "--spacing-card": "var(--card-padding)",
      "--spacing-gap": "var(--card-gap)",
    });
  });

  it("defines the overlay shadow", () => {
    expect(themeTokens.get("--shadow-overlay")).toBe(
      "0 12px 32px rgb(0 0 0 / 0.6)",
    );
  });

  it("defines the full type scale with line height, tracking and weight", () => {
    const scale: Record<string, [string, string, string, string]> = {
      hero: ["48px", "52px", "-0.03em", "800"],
      display: ["32px", "38px", "-0.02em", "700"],
      title: ["22px", "28px", "-0.01em", "700"],
      "body-lg": ["16px", "24px", "0", "500"],
      body: ["15px", "22px", "0", "400"],
      label: ["13px", "18px", "0", "500"],
      caption: ["12px", "16px", "0", "400"],
    };
    for (const [name, [size, lineHeight, tracking, weight]] of Object.entries(
      scale,
    )) {
      expectTokens(themeTokens, {
        [`--text-${name}`]: size,
        [`--text-${name}--line-height`]: lineHeight,
        [`--text-${name}--letter-spacing`]: tracking,
        [`--text-${name}--font-weight`]: weight,
      });
    }
  });

  it("maps the four font families to the next/font variables", () => {
    expect(themeTokens.get("--font-display")).toMatch(/^var\(--font-manrope\)/);
    expect(themeTokens.get("--font-sans")).toMatch(/^var\(--font-inter\)/);
    expect(themeTokens.get("--font-wordmark")).toMatch(/^var\(--font-cinzel\)/);
    expect(themeTokens.get("--font-mono")).toMatch(
      /^var\(--font-jetbrains-mono\)/,
    );
  });

  it("exposes the content width container", () => {
    expect(themeTokens.get("--container-content")).toBe("var(--content-width)");
  });
});

describe("motion constants", () => {
  function cssMs(name: string): number {
    const value = rootTokens.get(name) ?? "";
    expect(value, name).toMatch(/^\d+ms$/);
    return Number.parseInt(value, 10);
  }

  it("equal the CSS durations", () => {
    expect(motion.PRESS_DURATION_S * 1000).toBeCloseTo(cssMs("--duration-press"));
    expect(motion.TAB_DURATION_S * 1000).toBeCloseTo(cssMs("--duration-tab"));
    expect(motion.SHEET_DURATION_S * 1000).toBeCloseTo(cssMs("--duration-sheet"));
    expect(motion.COUNT_DURATION_S * 1000).toBeCloseTo(cssMs("--duration-count"));
    expect(motion.REDUCED_FADE_MAX_S * 1000).toBeCloseTo(
      cssMs("--duration-reduced-fade-max"),
    );
  });

  it("equals the CSS press scale", () => {
    expect(motion.PRESS_SCALE).toBe(Number(rootTokens.get("--press-scale")));
  });
});

describe("root layout fonts", () => {
  function fontCall(fn: string): string {
    const match = layout.match(new RegExp(`${fn}\\(\\{([\\s\\S]*?)\\}\\)`));
    if (!match) throw new Error(`Font call not found: ${fn}`);
    return match[1];
  }

  it("loads Manrope 700 and 800 with swap and its CSS variable", () => {
    const call = fontCall("Manrope");
    expect(call).toContain('variable: "--font-manrope"');
    expect(call).toMatch(/weight:\s*\["700",\s*"800"\]/);
    expect(call).toContain('display: "swap"');
  });

  it("loads Inter 400, 500 and 600 with swap and its CSS variable", () => {
    const call = fontCall("Inter");
    expect(call).toContain('variable: "--font-inter"');
    expect(call).toMatch(/weight:\s*\["400",\s*"500",\s*"600"\]/);
    expect(call).toContain('display: "swap"');
  });

  it("loads Cinzel 500 with swap and its CSS variable", () => {
    const call = fontCall("Cinzel");
    expect(call).toContain('variable: "--font-cinzel"');
    expect(call).toMatch(/weight:\s*"500"/);
    expect(call).toContain('display: "swap"');
  });

  it("loads JetBrains Mono 400 with swap and its CSS variable", () => {
    const call = fontCall("JetBrains_Mono");
    expect(call).toContain('variable: "--font-jetbrains-mono"');
    expect(call).toMatch(/weight:\s*"400"/);
    expect(call).toContain('display: "swap"');
  });

  it("applies all four font variable classes to the html element", () => {
    for (const name of ["manrope", "inter", "cinzel", "jetbrainsMono"]) {
      expect(layout).toContain(`\${${name}.variable}`);
    }
  });

  it("no longer imports Geist", () => {
    expect(layout).not.toMatch(/geist/i);
  });
});

describe("compiled theme: focus ring utilities", () => {
  // Compiles globals.css with the same Tailwind version the app uses (Turbopack loader).
  async function compileCandidates(candidates: string[]): Promise<string> {
    const { compile } = await import("@tailwindcss/node");
    const compiler = await compile(css, { base: ROOT_DIR, onDependency: () => undefined });
    return compiler.build(candidates).replace(/\s+/g, " ");
  }

  it("generates the focus color utility from --color-focus", async () => {
    const out = await compileCandidates(["outline-focus", "focus-visible:outline-focus"]);
    expect(out).toContain(".outline-focus { outline-color: var(--focus-ring); }");
    expect(out).toContain(".focus-visible\\:outline-focus:focus-visible { outline-color: var(--focus-ring); }");
  });

  it("compiles the ring to a solid 2px outline even though outline-none cancels the style variable", async () => {
    const out = await compileCandidates([
      "outline-none",
      "focus-visible:outline-solid",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
    ]);
    // The trap: outline-none sets the variable to none and outline-2 reads the variable.
    expect(out).toContain("--tw-outline-style: none;");
    expect(out).toContain(".focus-visible\\:outline-2:focus-visible { outline-style: var(--tw-outline-style); outline-width: 2px; }");
    // The fix: on focus the style is set back to solid.
    expect(out).toContain(".focus-visible\\:outline-solid:focus-visible { --tw-outline-style: solid; outline-style: solid; }");
    expect(out).toContain(".focus-visible\\:outline-offset-2:focus-visible { outline-offset: 2px; }");
  });
});

