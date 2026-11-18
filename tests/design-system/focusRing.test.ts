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
      RING_CLASSES.filter((cls) => !source.includes(cls)).map((cls) => `${name}: missing ${cls}`),
    );
}

/** Flags files that cancel the outline style with outline-none but never restore it on focus. */
export function findCanceledRings(files: Array<{ name: string; source: string }>): string[] {
  return files
    .filter(({ source }) => /\boutline-none\b/.test(source) && source.includes("focus-visible:outline-2"))
    .filter(({ source }) => !source.includes("focus-visible:outline-solid"))
    .map(({ name }) => `${name}: outline-none with focus-visible:outline-2 but no focus-visible:outline-solid`);
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

  it("ignores a primitive that renders no native focusable element", () => {
    const fixture = { name: "Static.tsx", source: `export const S = () => <span className="text-ink" />;` };
    expect(findMissingRingClasses([fixture])).toEqual([]);
  });
});
