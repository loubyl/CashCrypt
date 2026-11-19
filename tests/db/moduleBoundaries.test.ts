import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Feature: app-screens, module boundaries (Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 10.8, 31.10)

const ROOT = process.cwd();
const SOURCE_EXTENSIONS = [".ts", ".tsx"];

/** Pure db files: no clock, no randomness (calendar.ts getLocalDate is the only clock reader and lives in utils). */
const PURE_DB_FILES = [
  "src/lib/db/snapshotAdapter.ts",
  "src/lib/db/queries.ts",
  "src/lib/db/plans.ts",
];

/** Directories where React must never be imported. */
const REACT_FREE_DIRS = ["src/lib/exorcism", "src/lib/validation"];
const REACT_FREE_FILES = ["src/lib/db/snapshotAdapter.ts"];

/** Directories of this feature where GSAP must never be imported. */
const GSAP_FREE_DIRS = [
  "src/hooks",
  "src/lib/db",
  "src/lib/exorcism",
  "src/lib/demo",
  "src/lib/validation",
  "src/components/ui",
  "src/components/styleguide",
];
/** GSAP is owned by the scene layer; every other component folder is app-screens chrome. */
const GSAP_ALLOWED_COMPONENT_DIRS = ["src/components/house", "src/components/moments"];

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...listFiles(full));
    else files.push(full);
  }
  return files;
}

function repoPath(file: string): string {
  return toPosix(relative(ROOT, file));
}

function sourceFilesIn(dir: string): string[] {
  return listFiles(join(ROOT, dir)).filter((file) =>
    SOURCE_EXTENSIONS.some((ext) => file.endsWith(ext)),
  );
}

/** Replaces comments with spaces so line numbers stay stable and prose is not scanned. */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (_m, prefix: string) => prefix);
}

function findLines(source: string, pattern: RegExp): number[] {
  const lines: number[] = [];
  stripComments(source)
    .split("\n")
    .forEach((line, index) => {
      if (pattern.test(line)) lines.push(index + 1);
    });
  return lines;
}

/** Collects `path:line` violations of `pattern` across the given files. */
function scan(files: string[], pattern: RegExp): string[] {
  const violations: string[] = [];
  for (const file of files) {
    for (const line of findLines(readFileSync(file, "utf8"), pattern)) {
      violations.push(`${repoPath(file)}:${line}`);
    }
  }
  return violations;
}

/** Matches a module specifier (static import, re-export, dynamic import or require). */
function importPattern(specifier: string): RegExp {
  return new RegExp(
    `(?:from\\s*|import\\s*\\(?\\s*|require\\s*\\(\\s*)["'\`]${specifier}["'\`]`,
  );
}

const allSourceFiles = sourceFilesIn("src");

describe("module boundaries", () => {
  it("scans a non-trivial set of source files", () => {
    expect(allSourceFiles.length).toBeGreaterThan(20);
    for (const file of PURE_DB_FILES) {
      expect(existsSync(join(ROOT, file)), file).toBe(true);
    }
  });

  it("only src/lib/db/ imports dexie", () => {
    const outside = allSourceFiles.filter(
      (file) => !repoPath(file).startsWith("src/lib/db/"),
    );
    expect(scan(outside, importPattern("dexie"))).toEqual([]);
    const inside = allSourceFiles.filter((file) =>
      repoPath(file).startsWith("src/lib/db/"),
    );
    expect(scan(inside, importPattern("dexie")).length).toBeGreaterThan(0);
  });

  it("only src/hooks/ imports dexie-react-hooks", () => {
    const outside = allSourceFiles.filter(
      (file) => !repoPath(file).startsWith("src/hooks/"),
    );
    expect(scan(outside, importPattern("dexie-react-hooks"))).toEqual([]);
    const inside = sourceFilesIn("src/hooks");
    expect(scan(inside, importPattern("dexie-react-hooks")).length).toBeGreaterThan(0);
  });

  it("no component imports @/lib/db/ or @/lib/demo/", () => {
    const components = sourceFilesIn("src/components");
    expect(components.length).toBeGreaterThan(0);
    expect(scan(components, /["'`]@\/lib\/(?:db|demo)(?:\/|["'`])/)).toEqual([]);
  });

  it("no component calls computeHouseState", () => {
    expect(scan(sourceFilesIn("src/components"), /\bcomputeHouseState\b/)).toEqual([]);
  });

  it("src/lib/exorcism and the pure db files do not read the clock or randomness", () => {
    const files = [
      ...sourceFilesIn("src/lib/exorcism"),
      ...sourceFilesIn("src/lib/validation"),
      ...PURE_DB_FILES.map((file) => join(ROOT, file)),
    ];
    const pattern = /\bDate\.now\b|\bnew\s+Date\s*\(|\bMath\.random\b/;
    expect(scan(files, pattern)).toEqual([]);
  });

  it("no React import in exorcism, validation and the snapshot adapter", () => {
    const files = [
      ...REACT_FREE_DIRS.flatMap(sourceFilesIn),
      ...REACT_FREE_FILES.map((file) => join(ROOT, file)),
    ];
    expect(files.length).toBeGreaterThan(0);
    expect(scan(files, /["'`]react(?:\/[^"'`]*)?["'`]|["'`]react-dom(?:\/[^"'`]*)?["'`]/)).toEqual([]);
  });

  it("no GSAP import in the app-screens hooks, lib folders and components", () => {
    const componentFiles = sourceFilesIn("src/components").filter(
      (file) =>
        !GSAP_ALLOWED_COMPONENT_DIRS.some((dir) => repoPath(file).startsWith(`${dir}/`)),
    );
    const files = [...GSAP_FREE_DIRS.flatMap(sourceFilesIn), ...componentFiles];
    expect(files.length).toBeGreaterThan(0);
    expect(scan(files, /["'`](?:gsap|@gsap\/[^"'`]*)(?:\/[^"'`]*)?["'`]/)).toEqual([]);
  });

  describe("scan helpers", () => {
    it("detects a forbidden import and ignores one in a comment", () => {
      const pattern = importPattern("dexie");
      expect(findLines('import Dexie from "dexie";', pattern)).toEqual([1]);
      expect(findLines('// import Dexie from "dexie";', pattern)).toEqual([]);
      expect(findLines('import x from "dexie-react-hooks";', pattern)).toEqual([]);
    });

    it("detects clock and random calls", () => {
      const pattern = /\bDate\.now\b|\bnew\s+Date\s*\(|\bMath\.random\b/;
      expect(findLines("const a = Date.now();", pattern)).toEqual([1]);
      expect(findLines("x\nconst d = new Date(0);", pattern)).toEqual([2]);
      expect(findLines("/* Math.random() */", pattern)).toEqual([]);
    });
  });
});
