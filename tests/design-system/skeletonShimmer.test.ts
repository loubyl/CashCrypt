import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT_DIR = resolve(__dirname, "../..");
const css = readFileSync(resolve(ROOT_DIR, "src/app/globals.css"), "utf8");
const skeleton = readFileSync(resolve(ROOT_DIR, "src/components/common/Skeleton.tsx"), "utf8");

/** Returns the body of the first block that starts with `header`, matching braces. */
function blockBody(source: string, header: RegExp): string | null {
  const match = header.exec(source);
  if (!match) return null;
  let depth = 1;
  const start = match.index + match[0].length;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index);
  }
  return null;
}

describe("skeleton shimmer", () => {
  it("uses the animate-shimmer utility on every bar", () => {
    expect(skeleton).toContain("animate-shimmer");
  });

  it("turns the shimmer animation off under prefers-reduced-motion: reduce", () => {
    const reduced = blockBody(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*{/);
    expect(reduced).not.toBeNull();
    const rule = blockBody(reduced ?? "", /\.animate-shimmer\s*{/);
    expect(rule).not.toBeNull();
    expect(rule).toMatch(/animation:\s*none/);
  });

  it("declares the reduced-motion rule outside any @layer so it overrides the utility", () => {
    const mediaIndex = css.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*{\s*\.animate-shimmer/);
    expect(mediaIndex).toBeGreaterThan(-1);
    const before = css.slice(0, mediaIndex);
    const opened = (before.match(/{/g) ?? []).length;
    const closed = (before.match(/}/g) ?? []).length;
    expect(opened).toBe(closed);
  });

  it("uses surface tones only in the shimmer gradient (no accent colors)", () => {
    const gradient = /bg-linear-to-r[^"]*/.exec(skeleton)?.[0] ?? "";
    expect(gradient).toContain("from-surface-raised");
    expect(gradient).not.toMatch(/candle|ecto|blood|ghost|spirit/);
  });
});
