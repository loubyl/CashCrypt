// Shared helpers for the house-scene source scans (tests/scene/staticChecks.test.ts and tests/moments/staticChecks.test.ts).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export const ROOT = process.cwd();
export const SRC_DIR = join(ROOT, "src");

export type Violation = { file: string; line: number; rule: string; text: string };

export type SourceFile = { file: string; source: string };

const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const INDEX_NAMES = ["index.ts", "index.tsx"];
const ALIAS_PREFIX = "@/";

/** Every .ts and .tsx file under a directory, as paths relative to the project root. */
export function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listSourceFiles(full));
    else if (SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(relative(ROOT, full));
  }
  return out.sort();
}

export function loadSources(dir: string): SourceFile[] {
  return listSourceFiles(dir).map((file) => ({ file, source: readFileSync(join(ROOT, file), "utf8") }));
}

/**
 * Removes comments and, unless `keepStrings` is set, the contents of string and template literals.
 * Newlines are preserved so line numbers stay valid. Template `${...}` expressions stay as code.
 */
export function stripSource(source: string, keepStrings: boolean): string {
  let out = "";
  let i = 0;
  const templateBraceStack: number[] = [];
  let braceDepth = 0;
  const blank = (ch: string): string => (ch === "\n" ? "\n" : " ");

  const readQuoted = (quote: string): void => {
    out += quote;
    i += 1;
    while (i < source.length && source[i] !== quote && source[i] !== "\n") {
      if (source[i] === "\\" && i + 1 < source.length) {
        out += keepStrings ? source.slice(i, i + 2) : "  ";
        i += 2;
      } else {
        out += keepStrings ? source[i] : " ";
        i += 1;
      }
    }
    if (i < source.length && source[i] === quote) {
      out += quote;
      i += 1;
    }
  };

  const readTemplateText = (): void => {
    while (i < source.length) {
      const ch = source[i];
      if (ch === "`") {
        out += ch;
        i += 1;
        return;
      }
      if (ch === "$" && source[i + 1] === "{") {
        out += "${";
        i += 2;
        templateBraceStack.push(braceDepth);
        braceDepth += 1;
        return;
      }
      if (ch === "\\" && i + 1 < source.length) {
        out += keepStrings ? source.slice(i, i + 2) : "  ";
        i += 2;
        continue;
      }
      out += keepStrings ? ch : blank(ch);
      i += 1;
    }
  };

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") {
        out += " ";
        i += 1;
      }
    } else if (ch === "/" && next === "*") {
      out += "  ";
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        out += blank(source[i]);
        i += 1;
      }
      out += "  ";
      i += 2;
    } else if (ch === '"' || ch === "'") {
      readQuoted(ch);
    } else if (ch === "`") {
      out += ch;
      i += 1;
      readTemplateText();
    } else if (ch === "{") {
      braceDepth += 1;
      out += ch;
      i += 1;
    } else if (ch === "}") {
      braceDepth -= 1;
      out += ch;
      i += 1;
      if (templateBraceStack.length > 0 && templateBraceStack[templateBraceStack.length - 1] === braceDepth) {
        templateBraceStack.pop();
        readTemplateText();
      }
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

export function forEachLine(code: string, visit: (line: string, lineNumber: number) => void): void {
  code.split("\n").forEach((line, index) => visit(line, index + 1));
}

export function formatViolations(violations: Violation[]): string {
  return violations.map((v) => `${v.file}:${v.line} [${v.rule}] ${v.text}`).join("\n");
}

/** Runs line patterns against code with string contents blanked (comments always removed). */
export function findCodePatterns(
  file: string,
  source: string,
  patterns: ReadonlyArray<{ rule: string; pattern: RegExp }>,
): Violation[] {
  const violations: Violation[] = [];
  forEachLine(stripSource(source, false), (line, lineNumber) => {
    for (const { rule, pattern } of patterns) {
      if (pattern.test(line)) violations.push({ file, line: lineNumber, rule, text: line.trim() });
    }
  });
  return violations;
}

/** Runs line patterns against code with string contents kept (module specifiers, hex colors). */
export function findStringPatterns(
  file: string,
  source: string,
  patterns: ReadonlyArray<{ rule: string; pattern: RegExp }>,
): Violation[] {
  const violations: Violation[] = [];
  forEachLine(stripSource(source, true), (line, lineNumber) => {
    for (const { rule, pattern } of patterns) {
      if (pattern.test(line)) violations.push({ file, line: lineNumber, rule, text: line.trim() });
    }
  });
  return violations;
}

const STATIC_FROM_PATTERN = /\b(?:import|export)\b[^;'"`]*?\bfrom\s*["']([^"']+)["']/g;
const STATIC_SIDE_EFFECT_PATTERN = /\bimport\s*["']([^"']+)["']/g;

/** Module specifiers of static `import ... from`, `import "x"` and `export ... from`; never `import()`. */
export function staticSpecifiers(source: string): string[] {
  const code = stripSource(source, true);
  const specifiers: string[] = [];
  for (const match of code.matchAll(STATIC_FROM_PATTERN)) specifiers.push(match[1]);
  for (const match of code.matchAll(STATIC_SIDE_EFFECT_PATTERN)) specifiers.push(match[1]);
  return specifiers;
}

export function isGsapSpecifier(specifier: string): boolean {
  return specifier === "gsap" || specifier.startsWith("gsap/") || specifier.startsWith("@gsap/");
}

function resolveLocal(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith(ALIAS_PREFIX)) base = join(SRC_DIR, specifier.slice(ALIAS_PREFIX.length));
  else if (specifier.startsWith(".")) base = resolve(ROOT, dirname(fromFile), specifier);
  else return null;
  const candidates = [
    ...SOURCE_EXTENSIONS.map((ext) => base + ext),
    ...INDEX_NAMES.map((name) => join(base, name)),
  ];
  const found = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  return found ? relative(ROOT, found) : null;
}

/** Walks static imports from an entry file; returns every reachable project file and every external specifier. */
export function walkStaticImports(entry: string): { files: string[]; externals: Array<{ file: string; specifier: string }> } {
  const seen = new Set<string>();
  const externals: Array<{ file: string; specifier: string }> = [];
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of staticSpecifiers(readFileSync(join(ROOT, file), "utf8"))) {
      const local = resolveLocal(file, specifier);
      if (local) queue.push(local);
      else externals.push({ file, specifier });
    }
  }
  return { files: [...seen].sort(), externals };
}

const NUMERIC_LITERAL_PATTERN =
  /(?<![\w$.])(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)n?(?![\w$])/g;

/** Numeric literals whose value is not in `allowed`. */
export function findNumericLiterals(file: string, source: string, allowed: readonly number[]): Violation[] {
  const violations: Violation[] = [];
  forEachLine(stripSource(source, false), (line, lineNumber) => {
    for (const match of line.matchAll(NUMERIC_LITERAL_PATTERN)) {
      const value = Number(match[0].replace(/_/g, "").replace(/n$/, ""));
      if (!allowed.includes(value)) {
        violations.push({ file, line: lineNumber, rule: `numeric literal ${match[0]}`, text: line.trim() });
      }
    }
  });
  return violations;
}

/** `gsap.timeline(` calls outside any function or block (module scope). */
export function findModuleScopeTimelines(file: string, source: string): Violation[] {
  const violations: Violation[] = [];
  const code = stripSource(source, false);
  let depth = 0;
  let statementStart = 0;
  const timeline = /\bgsap\s*\.\s*timeline\s*\(/g;
  const lineStarts: number[] = [0];
  for (let i = 0; i < code.length; i += 1) if (code[i] === "\n") lineStarts.push(i + 1);
  const lineOf = (index: number): number => lineStarts.filter((start) => start <= index).length;
  const hits = new Set<number>();
  for (const match of code.matchAll(timeline)) hits.add(match.index as number);
  for (let i = 0; i < code.length; i += 1) {
    const ch = code[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      statementStart = i + 1;
    } else if (ch === ";") statementStart = i + 1;
    if (hits.has(i) && depth === 0) {
      const statement = code.slice(statementStart, i);
      // An expression-bodied arrow or function expression defers the call; it is not module scope.
      if (!/=>|\bfunction\b/.test(statement)) {
        violations.push({ file, line: lineOf(i), rule: "gsap.timeline at module scope", text: code.slice(i, i + 40).split("\n")[0] });
      }
    }
  }
  return violations;
}

const FORBIDDEN_LIB_MODULE_PATTERN =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])(react|react-dom|next|dexie|gsap|@gsap|framer-motion|motion)(?:\/[^"']*)?\1/;

const FORBIDDEN_LIB_CODE_PATTERNS: ReadonlyArray<{ rule: string; pattern: RegExp }> = [
  { rule: "Math.random", pattern: /\bMath\s*\.\s*random\b/ },
  { rule: "Date.now", pattern: /\bDate\s*\.\s*now\b/ },
  { rule: "new Date", pattern: /\bnew\s+Date\b/ },
];

/** Forbidden framework imports and nondeterministic APIs, for the framework-agnostic lib folders. */
export function findLibPurityViolations(file: string, source: string): Violation[] {
  return [
    ...findCodePatterns(file, source, FORBIDDEN_LIB_CODE_PATTERNS),
    ...findStringPatterns(file, source, [{ rule: "forbidden import", pattern: FORBIDDEN_LIB_MODULE_PATTERN }]),
  ];
}

const MOTION_IMPORT_PATTERN = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])(framer-motion|motion)(?:\/[^"']*)?\1/;
const MORPH_PATTERN = /MorphSVG/;
const ASSET_IMPORT_PATTERN =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])[^"']*\.(?:png|jpe?g|gif|webp|avif|ico|svg|woff2?|ttf|otf|eot)\1/;
const NEXT_ASSET_PATTERN = /(?:\bfrom\s*|\bimport\s*\(?\s*)(["'])next\/(?:font|image)(?:\/[^"']*)?\1/;
const GLOBAL_TIMELINE_PAUSE_PATTERN = /\bglobalTimeline\b[^;]*?\.\s*(?:pause|paused)\s*\(/;
const INLINE_HEX_PATTERN = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/;

/**
 * Rules shared by src/components/house/ and src/components/moments/: no Framer Motion, no MorphSVGPlugin,
 * no image or font asset imports, no module-scope gsap.timeline, no globalTimeline pause and no inline hex colors
 * (scene-only palette colors are imported from @/lib/scene/config).
 */
export function findSceneComponentViolations(file: string, source: string): Violation[] {
  return [
    ...findStringPatterns(file, source, [
      { rule: "Framer Motion import", pattern: MOTION_IMPORT_PATTERN },
      { rule: "asset import", pattern: ASSET_IMPORT_PATTERN },
      { rule: "next/font or next/image import", pattern: NEXT_ASSET_PATTERN },
      { rule: "inline hex color", pattern: INLINE_HEX_PATTERN },
    ]),
    ...findCodePatterns(file, source, [
      { rule: "MorphSVGPlugin", pattern: MORPH_PATTERN },
      { rule: "globalTimeline pause", pattern: GLOBAL_TIMELINE_PAUSE_PATTERN },
    ]),
    ...findModuleScopeTimelines(file, source),
  ];
}
