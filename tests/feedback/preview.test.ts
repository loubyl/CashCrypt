import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildLandingPreview } from "@/lib/demo/preview";

const SRC_ROOT = path.resolve(__dirname, "../../src");
const ENTRY = path.join(SRC_ROOT, "lib/demo/preview.ts");
const IMPORT_PATTERN = /^\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/gm;

function resolveModule(specifier: string, from: string): string | null {
  const base = specifier.startsWith("@/")
    ? path.join(SRC_ROOT, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(from), specifier)
      : null;
  if (base === null) return null;
  const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function collectGraph(entry: string): { files: string[]; externals: string[] } {
  const files = new Set<string>();
  const externals = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (files.has(file)) continue;
    files.add(file);
    for (const match of readFileSync(file, "utf8").matchAll(IMPORT_PATTERN)) {
      const specifier = match[1];
      const resolved = resolveModule(specifier, file);
      if (resolved !== null) queue.push(resolved);
      else if (!specifier.startsWith(".") && !specifier.startsWith("@/")) externals.add(specifier);
    }
  }
  return { files: [...files], externals: [...externals] };
}

describe("buildLandingPreview", () => {
  it("returns deeply equal models on two calls", () => {
    expect(buildLandingPreview()).toEqual(buildLandingPreview());
  });

  it("labels the level-4 demo house", () => {
    expect(buildLandingPreview().summary).toBe(
      "Preview of the demo house: Level 4, Crumbling. 5 zombies, 30 ghosts, Poltergeist awake, no tombstones",
    );
  });

  it("pulls no dexie import through its module graph", () => {
    const { files, externals } = collectGraph(ENTRY);
    expect(files.length).toBeGreaterThan(1);
    expect(externals.filter((name) => name === "dexie" || name.startsWith("dexie/"))).toEqual([]);
  });
});
