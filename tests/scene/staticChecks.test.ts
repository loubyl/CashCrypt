// Source scans for the house scene (Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 1.7, 1.8, 2.6, 21.1, 23.6).
import { describe, expect, it } from "vitest";
import {
  findCodePatterns,
  findLibPurityViolations,
  findModuleScopeTimelines,
  findNumericLiterals,
  findSceneComponentViolations,
  findStringPatterns,
  formatViolations,
  isGsapSpecifier,
  loadSources,
  SRC_DIR,
  staticSpecifiers,
  walkStaticImports,
  type Violation,
} from "./sourceScan";
import { join } from "node:path";

const SCENE_LIB_DIR = join(SRC_DIR, "lib", "scene");
const HOUSE_DIR = join(SRC_DIR, "components", "house");
const DASHBOARD_ENTRY = "src/components/dashboard/Dashboard.tsx";
const AMBIENT_MOTION_FILE = "src/components/house/AmbientMotion.tsx";
const MOMENT_FILE_PATTERN = /^src\/components\/moments\/[A-Za-z]+Moment\.ts$/;
/** Config is where every tunable number lives. */
const LITERAL_EXEMPT_FILE = "src/lib/scene/config.ts";
/** Only 0 and 1 are identities. */
const ALLOWED_SCENE_LITERALS: readonly number[] = [0, 1];

const CANVAS_CODE_PATTERNS = [
  { rule: "canvas element", pattern: /<canvas\b/i },
  { rule: "getContext", pattern: /\bgetContext\b/ },
  { rule: "WebGL", pattern: /\bWebGL\w*/i },
  { rule: "canvas type", pattern: /\b(?:HTMLCanvasElement|OffscreenCanvas|CanvasRenderingContext2D)\b/ },
];
const CANVAS_STRING_PATTERNS = [
  { rule: "createElement canvas", pattern: /createElement\(\s*["']canvas["']/ },
  { rule: "three import", pattern: /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])(?:three|@react-three)(?:\/[^"']*)?\1/ },
];

/**
 * Lines where a number is a declaration, not a magic number: a type-level declaration, an object key,
 * or a named SCREAMING_CASE constant (including `const LAST_LEVEL: DecayLevel = 5`).
 */
const DECLARATION_LINE_PATTERNS: readonly RegExp[] = [
  /^\s*(?:export\s+)?type\s/,
  /^\s*\d+\s*:/,
  /^\s*(?:export\s+)?const\s+[A-Z][A-Z0-9_]*\s*(?::[^=]+)?=\s*[-\w.]+\s*;?\s*$/,
];

function findMagicNumbers(file: string, source: string): Violation[] {
  return findNumericLiterals(file, source, ALLOWED_SCENE_LITERALS).filter(
    (v) => !DECLARATION_LINE_PATTERNS.some((pattern) => pattern.test(v.text)),
  );
}

function expectNone(violations: Violation[]): void {
  expect(formatViolations(violations)).toBe("");
}

describe("src/lib/scene source scan", () => {
  const sources = loadSources(SCENE_LIB_DIR);

  it("finds the scene lib files", () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it("imports no React, Next, Dexie, GSAP or Motion and uses no Math.random, Date.now or new Date", () => {
    expectNone(sources.flatMap(({ file, source }) => findLibPurityViolations(file, source)));
  });

  it("uses no numeric literal other than 0 and 1 outside config.ts", () => {
    const violations = sources
      .filter(({ file }) => file !== LITERAL_EXEMPT_FILE)
      .flatMap(({ file, source }) => findMagicNumbers(file, source));
    expectNone(violations);
  });

  it("flags the forbidden patterns when they are present", () => {
    expect(findLibPurityViolations("x.ts", 'import { gsap } from "gsap";\nconst a = Math.random();').length).toBe(2);
    expect(findLibPurityViolations("x.ts", "const a = new Date();\nconst b = Date.now();").length).toBe(2);
    expect(findMagicNumbers("x.ts", "const a = 0 + 1 * 2.5; // 7").length).toBe(1);
    expect(findMagicNumbers("x.ts", "const LIMIT = 5;").length).toBe(0);
  });
});

describe("src-wide scans", () => {
  const sources = loadSources(SRC_DIR);

  it("uses no canvas, getContext, WebGL or three", () => {
    const violations = sources.flatMap(({ file, source }) => [
      ...findCodePatterns(file, source, CANVAS_CODE_PATTERNS),
      ...findStringPatterns(file, source, CANVAS_STRING_PATTERNS),
    ]);
    expectNone(violations);
  });

  it("imports GSAP only in AmbientMotion.tsx and the Moment files", () => {
    const offenders = sources
      .filter(({ file }) => file !== AMBIENT_MOTION_FILE && !MOMENT_FILE_PATTERN.test(file))
      .filter(({ source }) => {
        const code = findStringPatterns("", source, [
          { rule: "gsap", pattern: /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])(?:gsap|@gsap)(?:\/[^"']*)?\1/ },
        ]);
        return code.length > 0;
      })
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("uses no Framer Motion in house/ or moments/", () => {
    const violations = sources
      .filter(({ file }) => file.startsWith("src/components/house/") || file.startsWith("src/components/moments/"))
      .flatMap(({ file, source }) => findSceneComponentViolations(file, source))
      .filter((v) => v.rule === "Framer Motion import");
    expectNone(violations);
  });

  it("never mentions MorphSVGPlugin", () => {
    const violations = sources.flatMap(({ file, source }) => findCodePatterns(file, source, [{ rule: "MorphSVGPlugin", pattern: /MorphSVG/ }]));
    expectNone(violations);
  });

  it("detects module-scope timelines but not timelines inside functions", () => {
    expect(findModuleScopeTimelines("x.ts", "const tl = gsap.timeline();").length).toBe(1);
    expect(findModuleScopeTimelines("x.ts", "function f() {\n  const tl = gsap.timeline();\n}").length).toBe(0);
    expect(findModuleScopeTimelines("x.ts", "const f = () => gsap.timeline();").length).toBe(0);
  });
});

describe("src/components/house source scan", () => {
  const sources = loadSources(HOUSE_DIR);

  it("has no Framer Motion, MorphSVGPlugin, asset import, inline hex color, module-scope timeline or globalTimeline pause", () => {
    expectNone(sources.flatMap(({ file, source }) => findSceneComponentViolations(file, source)));
  });

  it("flags an inline hex color and a globalTimeline pause", () => {
    expect(findSceneComponentViolations("x.tsx", 'const fill = "#4A6B3A";').length).toBe(1);
    expect(findSceneComponentViolations("x.tsx", "gsap.globalTimeline.pause();").length).toBe(1);
    expect(findSceneComponentViolations("x.tsx", 'import logo from "./logo.png";').length).toBe(1);
  });
});

describe("Dashboard static import walk", () => {
  it("reaches no gsap import through import and export-from statements", () => {
    const { files, externals } = walkStaticImports(DASHBOARD_ENTRY);
    expect(files).toContain("src/components/house/HouseScene.tsx");
    expect(files).not.toContain(AMBIENT_MOTION_FILE);
    expect(externals.filter(({ specifier }) => isGsapSpecifier(specifier))).toEqual([]);
  });

  it("follows export-from but ignores dynamic import()", () => {
    expect(staticSpecifiers('export { a } from "./a";\nexport * from "./b";\nimport c from "./c";\nimport "./d";')).toEqual([
      "./a",
      "./b",
      "./c",
      "./d",
    ]);
    expect(staticSpecifiers('const m = () => import("gsap");')).toEqual([]);
  });
});
