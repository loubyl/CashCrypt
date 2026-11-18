// Static purity and no-magic-number checks for src/lib/haunting/ (Requirements 1.1, 1.2, 7.4, 12.2, 12.3).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const HAUNTING_DIR = join(process.cwd(), "src", "lib", "haunting");

/** Test-only generators: exempt from every rule. */
const TEST_ONLY_FILE = "testArbitraries.ts";
/**
 * Files exempt from the numeric-literal rule.
 * - config.ts is where every tunable constant lives.
 * - dates.ts holds the Julian Day formula, which is fixed calendar arithmetic, not a tunable constant.
 * - testArbitraries.ts is test-only.
 */
const LITERAL_EXEMPT_FILES: readonly string[] = ["config.ts", "dates.ts", TEST_ONLY_FILE];
const CENTS_BOUNDARY_FILE = "index.ts";
const CENTS_CONSTANT = "CENTS_PER_DOLLAR";
const ROUND_CALL = "Math.round(";

/** Numeric literals that are always allowed (negative one is unary minus plus 1). */
const ALLOWED_LITERAL_VALUES: readonly number[] = [0, 1];

type Violation = { file: string; line: number; rule: string; text: string };

const FORBIDDEN_CODE_PATTERNS: ReadonlyArray<{ rule: string; pattern: RegExp }> = [
  { rule: "Date.now", pattern: /\bDate\s*\.\s*now\b/ },
  { rule: "new Date", pattern: /\bnew\s+Date\b/ },
  { rule: "Math.random", pattern: /\bMath\s*\.\s*random\b/ },
  { rule: "performance.now", pattern: /\bperformance\s*\.\s*now\b/ },
  { rule: "crypto.getRandomValues", pattern: /\bcrypto\s*\.\s*getRandomValues\b/ },
  { rule: "console.", pattern: /\bconsole\s*\./ },
  { rule: "fetch(", pattern: /\bfetch\s*\(/ },
  { rule: "localStorage", pattern: /\blocalStorage\b/ },
  { rule: "window", pattern: /\bwindow\b/ },
  { rule: "document", pattern: /\bdocument\b/ },
];

const FORBIDDEN_MODULE_PATTERN =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(["'])(react|dexie|next)(?:\/[^"']*)?\1/;

const NUMERIC_LITERAL_PATTERN = /(?<![\w$.])(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)n?(?![\w$])/g;

/**
 * Removes comments and, unless `keepStrings` is set, the contents of string and template
 * literals (template `${...}` expressions stay as code). Newlines are preserved so line
 * numbers stay valid.
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
    // Called with `i` just after an opening backtick or a closing `}` of an expression.
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

function parseLiteral(text: string): number {
  const cleaned = text.replace(/_/g, "").replace(/n$/, "");
  return Number(cleaned);
}

function forEachLine(code: string, visit: (line: string, lineNumber: number) => void): void {
  code.split("\n").forEach((line, index) => visit(line, index + 1));
}

/** Finds banned APIs, browser globals and framework imports. */
export function findPurityViolations(file: string, source: string): Violation[] {
  const violations: Violation[] = [];
  const codeNoStrings = stripSource(source, false);
  const codeWithStrings = stripSource(source, true);
  forEachLine(codeNoStrings, (line, lineNumber) => {
    for (const { rule, pattern } of FORBIDDEN_CODE_PATTERNS) {
      if (pattern.test(line)) violations.push({ file, line: lineNumber, rule, text: line.trim() });
    }
  });
  forEachLine(codeWithStrings, (line, lineNumber) => {
    if (FORBIDDEN_MODULE_PATTERN.test(line)) {
      violations.push({ file, line: lineNumber, rule: "forbidden import", text: line.trim() });
    }
  });
  return violations;
}

/** Finds numeric literals other than 0 and 1. */
export function findLiteralViolations(file: string, source: string): Violation[] {
  const violations: Violation[] = [];
  forEachLine(stripSource(source, false), (line, lineNumber) => {
    for (const match of line.matchAll(NUMERIC_LITERAL_PATTERN)) {
      if (!ALLOWED_LITERAL_VALUES.includes(parseLiteral(match[0]))) {
        violations.push({ file, line: lineNumber, rule: `numeric literal ${match[0]}`, text: line.trim() });
      }
    }
  });
  return violations;
}

/** Finds lines that round with the cents constant (the Cents_Boundary operation). */
export function findCentsRounding(source: string): number[] {
  const lines: number[] = [];
  const code = stripSource(source, false);
  forEachLine(code, (line, lineNumber) => {
    if (line.includes(ROUND_CALL) && line.includes(CENTS_CONSTANT)) lines.push(lineNumber);
  });
  return lines;
}

function formatViolations(violations: Violation[]): string {
  return violations.map((v) => `${v.file}:${v.line} [${v.rule}] ${v.text}`).join("\n");
}

function loadSources(): Array<{ file: string; source: string }> {
  return readdirSync(HAUNTING_DIR)
    .filter((name) => name.endsWith(".ts"))
    .map((file) => ({ file, source: readFileSync(join(HAUNTING_DIR, file), "utf8") }));
}

const SOURCES = loadSources();
const SCANNED = SOURCES.filter(({ file }) => file !== TEST_ONLY_FILE);

describe("static checks on src/lib/haunting", () => {
  it("finds the engine source files", () => {
    expect(SCANNED.length).toBeGreaterThan(0);
  });

  it("uses no clock, randomness, I/O, browser globals or framework imports", () => {
    const violations = SCANNED.flatMap(({ file, source }) => findPurityViolations(file, source));
    expect(formatViolations(violations)).toBe("");
  });

  it("uses no numeric literals other than 0 and 1 outside the exempt files", () => {
    const violations = SCANNED.filter(({ file }) => !LITERAL_EXEMPT_FILES.includes(file)).flatMap(
      ({ file, source }) => findLiteralViolations(file, source),
    );
    expect(formatViolations(violations)).toBe("");
  });

  it("rounds with CENTS_PER_DOLLAR only in index.ts", () => {
    const offenders = SCANNED.filter(({ file }) => file !== CENTS_BOUNDARY_FILE).flatMap(({ file, source }) =>
      findCentsRounding(source).map((line) => `${file}:${line}`),
    );
    expect(offenders.join("\n")).toBe("");
    const boundary = SCANNED.find(({ file }) => file === CENTS_BOUNDARY_FILE);
    expect(boundary).toBeDefined();
    expect(findCentsRounding(boundary?.source ?? "").length).toBeGreaterThan(0);
  });
});

describe("static check scanners", () => {
  it("detects each banned API", () => {
    const samples = [
      "const t = Date.now();",
      "const d = new Date();",
      "const r = Math.random();",
      "const p = performance.now();",
      "crypto.getRandomValues(a);",
      "console.log(x);",
      "await fetch(url);",
      "localStorage.getItem(k);",
      "const w = window.innerWidth;",
      "const d = document.body;",
    ];
    for (const sample of samples) {
      expect(findPurityViolations("sample.ts", sample), sample).toHaveLength(1);
    }
  });

  it("detects forbidden imports and reports the line", () => {
    const source = 'import a from "./a";\nimport { useState } from "react";\nimport Dexie from \'dexie\';\nimport x from "next/server";';
    const violations = findPurityViolations("sample.ts", source);
    expect(violations.map((v) => v.line)).toEqual([2, 3, 4]);
  });

  it("allows lookalike module names and ignores comments and strings", () => {
    const source = [
      'import a from "./reactive";',
      "// Date.now() in a comment",
      "/* new Date() in a block comment */",
      'const s = "Math.random() in a string";',
    ].join("\n");
    expect(findPurityViolations("sample.ts", source)).toEqual([]);
  });

  it("detects numeric literals other than 0 and 1", () => {
    const violations = findLiteralViolations("sample.ts", "const a = 0;\nconst b = 1;\nconst c = 2;\nconst d = 0.5;\nconst e = 1e3;\nconst f = -1;");
    expect(violations.map((v) => v.line)).toEqual([3, 4, 5]);
  });

  it("ignores digits in identifiers, comments, strings and member access", () => {
    const source = [
      "const BAND_L1_MIN = 0;",
      "// 42 in a comment",
      "/* 43 in a block */",
      'const s = "44";',
      "const t = `45 ${BAND_L2_MIN + 1} 46`;",
      "const u = arr.length - 1;",
    ].join("\n");
    expect(findLiteralViolations("sample.ts", source)).toEqual([]);
  });

  it("detects literals inside template expressions", () => {
    expect(findLiteralViolations("sample.ts", "const t = `a ${x * 7} b`;")).toHaveLength(1);
  });

  it("detects Math.round combined with the cents constant", () => {
    expect(findCentsRounding("const c = Math.round(x * CENTS_PER_DOLLAR);")).toEqual([1]);
    expect(findCentsRounding("const c = Math.round(x);")).toEqual([]);
    expect(findCentsRounding("// Math.round(x * CENTS_PER_DOLLAR)")).toEqual([]);
  });
});
