import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const UI_DIR = join(process.cwd(), "src", "components", "ui");
const SRC_DIR = join(process.cwd(), "src");

// The Focus_Ring (design.md, Decision 6b). outline-solid is required: in Tailwind v4,
// outline-none sets --tw-outline-style: none, and outline-2 reads that variable.
const RING_CLASSES = [
  "focus-visible:outline-solid",
  "focus-visible:outline-2",
  "focus-visible:outline-offset-2",
  "focus-visible:outline-focus",
] as const;

// Input exception (design-system.md, Input): one 2px line instead of the offset ring. The outline
// sits on the 1px border (-outline-offset-1 covers the border) and the border takes the same
// color, so a single line shows. Candle normally, blood when the field has an error. It must still
// be a visible 2px solid outline, and it must not use the 2px offset that would leave a gap.
const INPUT_RING_CLASSES = [
  "focus-visible:outline-solid",
  "focus-visible:outline-2",
  "focus-visible:-outline-offset-1",
  "focus-visible:outline-focus",
  "focus-visible:border-candle",
  "focus-visible:outline-blood",
  "focus-visible:border-blood",
] as const;
const INPUT_FORBIDDEN_CLASSES = ["focus-visible:outline-offset-2"] as const;
const INPUT_FILE = /(?:^|\/)Input\.tsx$/;

function requiredClasses(name: string): readonly string[] {
  return INPUT_FILE.test(name) ? INPUT_RING_CLASSES : RING_CLASSES;
}

function forbiddenClasses(name: string): readonly string[] {
  return INPUT_FILE.test(name) ? INPUT_FORBIDDEN_CLASSES : [];
}

// A primitive is interactive when it renders a native focusable element itself.
// Primitives that only compose other primitives (for example Toast using Button) get the ring from them.
const NATIVE_INTERACTIVE = /<(?:motion\.)?(?:button|a|input|select|textarea)\b|<Link\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

/** Lists which interactive files miss which ring classes. Exported for the fixture tests below. */
export function findMissingRingClasses(files: Array<{ name: string; source: string }>): string[] {
  return files
    .filter(({ source }) => NATIVE_INTERACTIVE.test(source))
    .flatMap(({ name, source }) =>
      [
        ...requiredClasses(name).filter((cls) => !source.includes(cls)).map((cls) => `${name}: missing ${cls}`),
        ...forbiddenClasses(name).filter((cls) => source.includes(cls)).map((cls) => `${name}: must not use ${cls}`),
      ],
    );
}

/** Flags files that cancel the outline style with outline-none but never restore it on focus. */
export function findCanceledRings(files: Array<{ name: string; source: string }>): string[] {
  return files
    .filter(({ source }) => /\boutline-none\b/.test(source) && source.includes("focus-visible:outline-2"))
    .filter(({ source }) => !source.includes("focus-visible:outline-solid"))
    .map(({ name }) => `${name}: outline-none with focus-visible:outline-2 but no focus-visible:outline-solid`);
}

const FOCUS_TARGET_OPEN = /<(?:motion\.)?(?:button|a|input|select|textarea)\b|<Link\b/g;

/** Returns the source of one JSX opening tag, scanning past `>` inside braces and strings. */
function readOpeningTag(source: string, start: number): string {
  let depth = 0;
  let quote = "";
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === quote && source[i - 1] !== "\\") quote = "";
    } else if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
    } else if (ch === ">" && depth === 0 && source[i - 1] !== "=") {
      return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

/** Returns the text of the `className` attribute value (string literal or `{expression}`), or null. */
function readClassName(tag: string): string | null {
  const match = /\bclassName=/.exec(tag);
  if (!match) return null;
  const from = match.index + match[0].length;
  if (tag[from] === '"') return tag.slice(from, tag.indexOf('"', from + 1) + 1);
  if (tag[from] !== "{") return null;
  let depth = 0;
  for (let i = from; i < tag.length; i += 1) {
    if (tag[i] === "{") depth += 1;
    if (tag[i] === "}") depth -= 1;
    if (depth === 0) return tag.slice(from, i + 1);
  }
  return tag.slice(from);
}

/** Expands identifiers in an expression into the text of their `const` declarations, transitively. */
function resolveClassText(expression: string, source: string, seen = new Set<string>()): string {
  let text = expression;
  for (const id of expression.match(/[A-Za-z_$][\w$]*/g) ?? []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const declaration = new RegExp(`\\b(?:const|let)\\s+${id.replace(/\$/g, "\\$")}\\b[^;]*?=([\\s\\S]*?);\\s*\n`).exec(source);
    if (declaration) text += `\n${resolveClassText(declaration[1], source, seen)}`;
  }
  return text;
}

/**
 * Checks the element that actually receives focus: each native focusable tag must carry the full
 * ring in its own className. Ring classes on a wrapper or elsewhere in the file do not count.
 */
export function findFocusTargetsMissingRing(files: Array<{ name: string; source: string }>): string[] {
  return files.flatMap(({ name, source }) =>
    [...source.matchAll(FOCUS_TARGET_OPEN)].flatMap((open) => {
      const tag = readOpeningTag(source, open.index);
      const label = `${name}: ${open[0]}`;
      const className = readClassName(tag);
      if (className === null) return [`${label} has no className, so it has no ring`];
      const resolved = resolveClassText(className, source);
      return [
        ...requiredClasses(name).filter((cls) => !resolved.includes(cls)).map((cls) => `${label} missing ${cls}`),
        ...forbiddenClasses(name).filter((cls) => resolved.includes(cls)).map((cls) => `${label} must not use ${cls}`),
      ];
    }),
  );
}

const read = (path: string) => ({ name: path.slice(process.cwd().length + 1), source: readFileSync(path, "utf8") });
const uiFiles = sourceFiles(UI_DIR).map(read);
const allSrcFiles = sourceFiles(SRC_DIR).map(read);

describe("Focus_Ring source scan", () => {
  it("finds the interactive primitives it is meant to check", () => {
    const interactive = uiFiles.filter(({ source }) => NATIVE_INTERACTIVE.test(source)).map(({ name }) => name);
    expect(interactive).toEqual(
      expect.arrayContaining([
        "src/components/ui/Button.tsx",
        "src/components/ui/Card.tsx",
        "src/components/ui/Input.tsx",
        "src/components/ui/ListRow.tsx",
      ]),
    );
  });

  it("gives every interactive primitive in src/components/ui the full focus-visible ring", () => {
    expect(findMissingRingClasses(uiFiles)).toEqual([]);
  });

  it("puts the full ring on the element that receives focus, not just somewhere in the file", () => {
    expect(findFocusTargetsMissingRing(uiFiles)).toEqual([]);
  });

  it("checks the native <input> inside Input", () => {
    const input = uiFiles.find(({ name }) => name.endsWith("Input.tsx"));
    expect(input).toBeDefined();
    expect([...input!.source.matchAll(FOCUS_TARGET_OPEN)]).toHaveLength(1);
  });

  it("never cancels the outline style without restoring it on focus anywhere in src", () => {
    expect(findCanceledRings(allSrcFiles)).toEqual([]);
  });

  it("flags a fixture that pairs outline-none with the ring but omits outline-solid", () => {
    const fixture = {
      name: "Fixture.tsx",
      source: `export const F = () => <button className="outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" />;`,
    };
    expect(findMissingRingClasses([fixture])).toEqual(["Fixture.tsx: missing focus-visible:outline-solid"]);
    expect(findCanceledRings([fixture])).toHaveLength(1);
  });

  it("flags a focusable element whose ring sits only on its wrapper", () => {
    const fixture = {
      name: "Wrapped.tsx",
      source: `const RING = "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
export const W = () => <div className={RING}><input className="px-4" /></div>;`,
    };
    expect(findMissingRingClasses([fixture])).toEqual([]);
    expect(findFocusTargetsMissingRing([fixture])).toHaveLength(4);
  });

  it("flags a focusable element with no className and accepts one whose ring comes via constants", () => {
    const bare = { name: "Bare.tsx", source: `export const B = () => <button type="button" onClick={() => {}} />;` };
    expect(findFocusTargetsMissingRing([bare])).toHaveLength(1);
    const ok = {
      name: "Ok.tsx",
      source: `const RING = "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const all = [RING, "px-4"].join(" ");
export const O = () => <input onChange={(e) => e} className={all} />;`,
    };
    expect(findFocusTargetsMissingRing([ok])).toEqual([]);
  });

  it("lets only Input use the single-line focus style, and keeps it a visible 2px line", () => {
    const base = "focus-visible:outline-solid focus-visible:outline-2";
    const inputRing = `${base} focus-visible:-outline-offset-1 focus-visible:outline-focus focus-visible:border-candle focus-visible:outline-blood focus-visible:border-blood`;
    const input = { name: "src/components/ui/Input.tsx", source: `export const I = () => <input className="${inputRing}" />;` };
    expect(findFocusTargetsMissingRing([input])).toEqual([]);
    // The same classes on any other primitive are not enough: it needs the offset ring.
    const button = { name: "src/components/ui/Button.tsx", source: input.source.replace("<input", "<button") };
    expect(findFocusTargetsMissingRing([button])).toContain("src/components/ui/Button.tsx: <button missing focus-visible:outline-offset-2");
    // Input with the offset ring has a gap, and without outline-2 or outline-solid it has no visible line.
    const gap = { ...input, source: input.source.replace("-outline-offset-1", "outline-offset-2") };
    expect(findFocusTargetsMissingRing([gap])).toEqual(
      expect.arrayContaining([
        "src/components/ui/Input.tsx: <input missing focus-visible:-outline-offset-1",
        "src/components/ui/Input.tsx: <input must not use focus-visible:outline-offset-2",
      ]),
    );
    const thin = { ...input, source: input.source.replace("focus-visible:outline-2", "") };
    expect(findFocusTargetsMissingRing([thin])).toContain("src/components/ui/Input.tsx: <input missing focus-visible:outline-2");
    // No blood variant means an errored field would focus in candle.
    const noBlood = { ...input, source: input.source.replace("focus-visible:outline-blood", "") };
    expect(findFocusTargetsMissingRing([noBlood])).toContain("src/components/ui/Input.tsx: <input missing focus-visible:outline-blood");
  });

  it("ignores a primitive that renders no native focusable element", () => {
    const fixture = { name: "Static.tsx", source: `export const S = () => <span className="text-ink" />;` };
    expect(findMissingRingClasses([fixture])).toEqual([]);
  });
});
