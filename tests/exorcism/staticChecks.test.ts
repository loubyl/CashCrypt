// Static checks for src/lib/exorcism/ (Requirements 11.7, 13.5).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FALLBACK_KEYS } from "@/lib/exorcism/config";

type Violation = { file: string; line: number; rule: string; text: string };

const ALLOWED_LITERAL_VALUES: readonly number[] = [0, 1];
const NUMERIC_LITERAL_PATTERN = /(?<![\w$.])(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)n?(?![\w$])/g;

/** Blanks comments and string/template text (keeps `${...}` code and newlines). */
function stripSource(source: string): string {
  let out = "";
  let i = 0;
  const braceStack: number[] = [];
  let depth = 0;
  const blank = (ch: string): string => (ch === "\n" ? "\n" : " ");
  const readTemplate = (): void => {
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
        braceStack.push(depth);
        depth += 1;
        return;
      }
      const width = ch === "\\" ? 2 : 1;
      out += source.slice(i, i + width).replace(/[^\n]/g, " ");
      i += width;
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
      out += ch;
      i += 1;
      while (i < source.length && source[i] !== ch && source[i] !== "\n") {
        const width = source[i] === "\\" ? 2 : 1;
        out += " ".repeat(width);
        i += width;
      }
      out += ch;
      i += 1;
    } else if (ch === "`") {
      out += ch;
      i += 1;
      readTemplate();
    } else {
      if (ch === "{") depth += 1;
      if (ch === "}") {
        depth -= 1;
        out += ch;
        i += 1;
        if (braceStack.length > 0 && braceStack[braceStack.length - 1] === depth) {
          braceStack.pop();
          readTemplate();
        }
        continue;
      }
      out += ch;
      i += 1;
    }
  }
  return out;
}

/** Finds numeric literals other than 0 and 1 (-1 is unary minus plus 1). */
function findLiteralViolations(file: string, source: string): Violation[] {
  const violations: Violation[] = [];
  stripSource(source)
    .split("\n")
    .forEach((line, index) => {
      for (const match of line.matchAll(NUMERIC_LITERAL_PATTERN)) {
        const value = Number(match[0].replace(/_/g, "").replace(/n$/, ""));
        if (!ALLOWED_LITERAL_VALUES.includes(value)) {
          violations.push({ file, line: index + 1, rule: `numeric literal ${match[0]}`, text: line.trim() });
        }
      }
    });
  return violations;
}

const EXORCISM_DIR = join(process.cwd(), "src", "lib", "exorcism");
const LITERAL_EXEMPT_FILES: readonly string[] = ["config.ts"];
const FALLBACK_ID_PREFIX = "fallback:";

function loadSources(): Array<{ file: string; source: string }> {
  return readdirSync(EXORCISM_DIR)
    .filter((name) => name.endsWith(".ts"))
    .map((file) => ({ file, source: readFileSync(join(EXORCISM_DIR, file), "utf8") }));
}

const SOURCES = loadSources();

describe("static checks on src/lib/exorcism", () => {
  it("finds the planner source files", () => {
    expect(SOURCES.map(({ file }) => file)).toEqual(expect.arrayContaining(["config.ts", "index.ts", "types.ts"]));
  });

  it("uses no numeric literals other than 0, 1 and -1 outside config.ts", () => {
    const violations = SOURCES.filter(({ file }) => !LITERAL_EXEMPT_FILES.includes(file)).flatMap(
      ({ file, source }) => findLiteralViolations(file, source),
    );
    expect(violations.map((v) => `${v.file}:${v.line} [${v.rule}] ${v.text}`).join("\n")).toBe("");
  });

  it("detects a stray literal in a sample (the scan can fail)", () => {
    expect(findLiteralViolations("sample.ts", "const a = x * 100;\nconst b = -1;")).toHaveLength(1);
  });

  it("orders fallback ids by code point exactly as FALLBACK_KEYS lists them", () => {
    const ids = FALLBACK_KEYS.map((key) => `${FALLBACK_ID_PREFIX}${key}`);
    const sorted = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(sorted).toEqual(ids);
  });

  it("lists distinct fallback keys", () => {
    expect(new Set(FALLBACK_KEYS).size).toBe(FALLBACK_KEYS.length);
  });
});
