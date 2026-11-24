import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "src");
const UI_DIR = join(SRC_DIR, "components", "ui");
const SCANNED_EXTENSIONS = [".ts", ".tsx", ".css"];

/** Paths (relative to the repository root, with `/`) that the color scan skips. */
const COLOR_SCAN_EXCLUDED = [
  "src/app/globals.css",
  "src/lib/haunting/",
  "src/lib/exorcism/",
  "src/components/house/",
  "src/components/moments/",
  // Scene-only decay tints and creature colors with no chrome equivalent (house-scene Requirement 2.3).
  // A single file, not the folder, so the rest of src/lib/scene/ stays scanned.
  "src/lib/scene/config.ts",
];

const HEX_COLOR_PATTERN = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_])/;
const COLOR_FUNCTION_PATTERN = /\b(?:rgba?|hsla?|oklch)\(/;

const VISUAL_PREFIXES = [
  "bg-",
  "border",
  "rounded",
  "shadow",
  "font-",
  "ring-",
  "outline-",
];
const PADDING_PATTERN = /^p[xytrblse]?-/;
/** `text-*` utilities that only affect layout (alignment, wrapping, overflow). */
const LAYOUT_TEXT_PATTERN =
  /^text-(?:left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip)$/;

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function repoPath(file: string): string {
  return toPosix(relative(ROOT, file));
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function read(file: string): string {
  return readFileSync(file, "utf8");
}

// ---------------------------------------------------------------------------
// Color literal detection
// ---------------------------------------------------------------------------

/** Returns the 1-based line numbers that contain a hex literal or color function. */
export function findColorLiteralLines(source: string): number[] {
  const lines: number[] = [];
  source.split("\n").forEach((line, index) => {
    if (HEX_COLOR_PATTERN.test(line) || COLOR_FUNCTION_PATTERN.test(line)) {
      lines.push(index + 1);
    }
  });
  return lines;
}

// ---------------------------------------------------------------------------
// Import detection
// ---------------------------------------------------------------------------

/** Returns every module specifier referenced by import, dynamic import or require. */
export function findImportSpecifiers(source: string): string[] {
  const pattern = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\(\s*)["']([^"']+)["']/g;
  return Array.from(source.matchAll(pattern), (match) => match[1]);
}

function hasDefaultExport(source: string): boolean {
  return /^\s*export\s+default\b/m.test(source);
}

function isGsapSpecifier(specifier: string): boolean {
  return (
    specifier === "gsap" ||
    specifier.startsWith("gsap/") ||
    specifier.startsWith("@gsap/")
  );
}

function startsWithAny(specifier: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`),
  );
}

// ---------------------------------------------------------------------------
// className scan (Decision 5)
// ---------------------------------------------------------------------------

export type ClassNameViolation = {
  line: number;
  tag: string;
  utility: string;
};

/** Returns the local names of everything imported from `@/components/ui/*`. */
function findPrimitiveNames(source: string): Set<string> {
  const names = new Set<string>();
  const importPattern = /import\s+(type\s+)?([^;]*?)\s+from\s*["']@\/components\/ui\/[^"']+["']/g;
  for (const match of source.matchAll(importPattern)) {
    if (match[1]) continue;
    const clause = match[2];
    const defaultPart = clause.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
    if (defaultPart) names.add(defaultPart[1]);
    const namedPart = clause.match(/\{([^}]*)\}/);
    if (namedPart) {
      for (const item of namedPart[1].split(",")) {
        const trimmed = item.trim();
        if (!trimmed || trimmed.startsWith("type ")) continue;
        const local = trimmed.split(/\s+as\s+/).pop();
        if (local) names.add(local.trim());
      }
    }
    const namespacePart = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (namespacePart) names.add(namespacePart[1]);
  }
  return names;
}

/** Returns the index just after the closing `>` of the tag that starts at `start`. */
function findTagEnd(source: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || (char === "`" && depth > 0)) quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ">" && depth === 0) return i + 1;
  }
  return source.length;
}

/** Returns the raw text of each `className` attribute value inside a tag. */
function extractClassNameValues(tagText: string): string[] {
  const values: string[] = [];
  const attribute = /\bclassName\s*=\s*/g;
  for (const match of tagText.matchAll(attribute)) {
    const valueStart = match.index + match[0].length;
    const first = tagText[valueStart];
    if (first === '"' || first === "'") {
      const end = tagText.indexOf(first, valueStart + 1);
      values.push(tagText.slice(valueStart + 1, end === -1 ? undefined : end));
    } else if (first === "{") {
      let depth = 0;
      let end = valueStart;
      for (; end < tagText.length; end += 1) {
        if (tagText[end] === "{") depth += 1;
        else if (tagText[end] === "}") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      values.push(tagText.slice(valueStart + 1, end));
    }
  }
  return values;
}

/** Keeps only the literal text of a className expression (strings and template text). */
function literalFragments(value: string): string {
  const withoutExpressions = value.replace(/\$\{[^}]*\}/g, " ");
  const strings = Array.from(
    withoutExpressions.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g),
    (m) => m[1] ?? m[2] ?? m[3] ?? "",
  );
  return strings.length > 0 ? strings.join(" ") : withoutExpressions;
}

function isVisualUtility(token: string): boolean {
  const base = token.split(":").pop()?.replace(/^[!-]+/, "") ?? "";
  if (VISUAL_PREFIXES.some((prefix) => base.startsWith(prefix))) return true;
  if (PADDING_PATTERN.test(base)) return true;
  return base.startsWith("text-") && !LAYOUT_TEXT_PATTERN.test(base);
}

/**
 * Finds JSX elements whose tag is a primitive imported from `@/components/ui/*`
 * and whose `className` literal contains a visual utility.
 */
export function findClassNameViolations(source: string): ClassNameViolation[] {
  const primitives = findPrimitiveNames(source);
  const violations: ClassNameViolation[] = [];
  if (primitives.size === 0) return violations;
  const tagPattern = /<([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)(?=[\s/>])/g;
  for (const match of source.matchAll(tagPattern)) {
    const tag = match[1];
    if (!primitives.has(tag.split(".")[0])) continue;
    const end = findTagEnd(source, match.index + match[0].length);
    const tagText = source.slice(match.index, end);
    for (const value of extractClassNameValues(tagText)) {
      for (const token of literalFragments(value).split(/\s+/)) {
        if (token && isVisualUtility(token)) {
          violations.push({
            line: lineOf(source, match.index),
            tag,
            utility: token,
          });
        }
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SOURCE_FILES = listFiles(SRC_DIR).filter((file) =>
  SCANNED_EXTENSIONS.some((extension) => file.endsWith(extension)),
);
const UI_TSX_FILES = listFiles(UI_DIR).filter((file) => file.endsWith(".tsx"));
const UI_SOURCE_FILES = listFiles(UI_DIR).filter(
  (file) => file.endsWith(".ts") || file.endsWith(".tsx"),
);
const CLASSNAME_SCAN_FILES = [
  ...listFiles(join(SRC_DIR, "app")),
  ...listFiles(join(SRC_DIR, "components")),
].filter(
  (file) =>
    file.endsWith(".tsx") && !repoPath(file).startsWith("src/components/ui/"),
);

describe("color literal scan", () => {
  it("finds no hex literal or color function outside the token sheet and scene folders", () => {
    const offenders: string[] = [];
    for (const file of SOURCE_FILES) {
      const path = repoPath(file);
      if (COLOR_SCAN_EXCLUDED.some((excluded) => path.startsWith(excluded))) {
        continue;
      }
      for (const line of findColorLiteralLines(read(file))) {
        offenders.push(`${path}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("detects hex literals and color functions and reports the line", () => {
    expect(findColorLiteralLines("a\nconst c = '#FFB547';\nb")).toEqual([2]);
    expect(findColorLiteralLines("x: #fff;")).toEqual([1]);
    expect(findColorLiteralLines("rgb(0 0 0)\nok\nhsl(1 2% 3%)\noklch(1 0 0)")).toEqual([1, 3, 4]);
    expect(findColorLiteralLines("color: var(--accent-candle); #main")).toEqual([]);
  });
});

describe("chrome primitive import scan", () => {
  it("keeps GSAP, the database, hooks and the haunting engine out of src/components/ui", () => {
    const forbidden = ["@/lib/db", "@/hooks", "@/lib/haunting"];
    const offenders: string[] = [];
    for (const file of UI_SOURCE_FILES) {
      for (const specifier of findImportSpecifiers(read(file))) {
        if (isGsapSpecifier(specifier) || startsWithAny(specifier, forbidden)) {
          offenders.push(`${repoPath(file)} imports ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("uses named exports only in src/components/ui", () => {
    const offenders = UI_SOURCE_FILES.filter((file) => hasDefaultExport(read(file)));
    expect(offenders.map(repoPath)).toEqual([]);
  });

  it("keeps ExorcismActionRow independent of the exorcism planner", () => {
    const file = join(UI_DIR, "ExorcismActionRow.tsx");
    if (!existsSync(file)) return;
    const specifiers = findImportSpecifiers(read(file));
    expect(specifiers.filter((s) => startsWithAny(s, ["@/lib/exorcism"]))).toEqual([]);
  });

  it("detects forbidden imports and default exports in fixtures", () => {
    expect(findImportSpecifiers(`import gsap from "gsap";\nimport { x } from '@/hooks/useX';`)).toEqual([
      "gsap",
      "@/hooks/useX",
    ]);
    expect(isGsapSpecifier("@gsap/react")).toBe(true);
    expect(isGsapSpecifier("gsap-like")).toBe(false);
    expect(hasDefaultExport("export default function A() {}")).toBe(true);
    expect(hasDefaultExport("export function A() {}")).toBe(false);
  });
});

describe("styleguide isolation scan", () => {
  it("keeps StyleguideContent free of database, hook and scene imports", () => {
    const file = join(SRC_DIR, "components", "styleguide", "StyleguideContent.tsx");
    expect(existsSync(file)).toBe(true);
    const forbidden = ["@/lib/db", "@/hooks", "@/components/house", "@/components/moments"];
    const offenders = findImportSpecifiers(read(file)).filter((s) =>
      startsWithAny(s, forbidden),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps the styleguide page a Server Component", () => {
    const file = join(SRC_DIR, "app", "styleguide", "page.tsx");
    expect(existsSync(file)).toBe(true);
    expect(read(file)).not.toMatch(/["']use client["']/);
  });
});

describe("className layout-only scan", () => {
  it("finds no visual utility on a primitive outside src/components/ui", () => {
    const offenders: string[] = [];
    for (const file of CLASSNAME_SCAN_FILES) {
      for (const violation of findClassNameViolations(read(file))) {
        offenders.push(
          `${repoPath(file)}:${violation.line} <${violation.tag}> uses ${violation.utility}`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  const header = `import { Button } from "@/components/ui/Button";\n`;

  it("flags a visual utility on a primitive", () => {
    const violations = findClassNameViolations(
      `${header}export const A = () => <Button className="bg-ecto">Go</Button>;`,
    );
    expect(violations).toEqual([{ line: 2, tag: "Button", utility: "bg-ecto" }]);
  });

  it("passes layout-only utilities on a primitive", () => {
    expect(
      findClassNameViolations(
        `${header}export const A = () => <Button className="mt-4 w-full">Go</Button>;`,
      ),
    ).toEqual([]);
  });

  it("flags each kind of visual utility, including variants and expressions", () => {
    const utilities = [
      "text-candle",
      "border",
      "border-control",
      "rounded-lg",
      "p-4",
      "px-2",
      "shadow-md",
      "font-display",
      "ring-1",
      "outline-2",
      "hover:bg-blood",
    ];
    for (const utility of utilities) {
      expect(
        findClassNameViolations(`${header}<Button className="mt-2 ${utility}" />`),
      ).toHaveLength(1);
    }
    expect(
      findClassNameViolations(`${header}<Button className={cond ? "mt-2" : "bg-blood"} />`),
    ).toHaveLength(1);
    expect(
      findClassNameViolations(`${header}<Button className={\`w-full \${x} rounded-md\`} />`),
    ).toHaveLength(1);
  });

  it("ignores native elements and primitives not imported from the ui folder", () => {
    expect(findClassNameViolations(`${header}<div className="bg-ecto p-4" />`)).toEqual([]);
    expect(
      findClassNameViolations(`import { Button } from "./Button";\n<Button className="bg-ecto" />`),
    ).toEqual([]);
  });

  it("allows text alignment utilities and does not stop at a > inside an attribute", () => {
    expect(
      findClassNameViolations(`${header}<Button className="text-center mt-2" />`),
    ).toEqual([]);
    expect(
      findClassNameViolations(
        `${header}<Button onClick={() => a > b} className="bg-ecto" />`,
      ),
    ).toHaveLength(1);
  });
});

describe("scans on an empty or missing ui folder", () => {
  it("treats a missing directory as having no files", () => {
    expect(listFiles(join(SRC_DIR, "components", "__does_not_exist__"))).toEqual([]);
    expect(UI_TSX_FILES.every((file) => file.endsWith(".tsx"))).toBe(true);
  });
});
