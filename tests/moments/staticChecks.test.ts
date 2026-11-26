// Source scans for the Moment queue and Moment components (Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 21.1, 23.6).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findLibPurityViolations,
  findSceneComponentViolations,
  formatViolations,
  loadSources,
  SRC_DIR,
  type Violation,
} from "../scene/sourceScan";

function expectNone(violations: Violation[]): void {
  expect(formatViolations(violations)).toBe("");
}

describe("src/lib/moments source scan", () => {
  const sources = loadSources(join(SRC_DIR, "lib", "moments"));

  it("finds the Moment lib files", () => {
    expect(sources.length).toBeGreaterThan(2);
  });

  it("imports no React, Next, Dexie, GSAP or Motion and uses no Math.random, Date.now or new Date", () => {
    expectNone(sources.flatMap(({ file, source }) => findLibPurityViolations(file, source)));
  });
});

describe("src/components/moments source scan", () => {
  const sources = loadSources(join(SRC_DIR, "components", "moments"));

  it("has no Framer Motion, MorphSVGPlugin, asset import, inline hex color, module-scope timeline or globalTimeline pause", () => {
    expectNone(sources.flatMap(({ file, source }) => findSceneComponentViolations(file, source)));
  });

  it("flags a Framer Motion import and a module-scope timeline", () => {
    expect(findSceneComponentViolations("x.ts", 'import { motion } from "framer-motion";').length).toBe(1);
    expect(findSceneComponentViolations("x.ts", "const tl = gsap.timeline();").length).toBe(1);
  });
});
