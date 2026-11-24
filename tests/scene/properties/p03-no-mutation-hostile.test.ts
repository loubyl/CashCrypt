// Feature: house-scene, Property 3: No mutation and no throw on hostile numbers
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildSceneModel } from "@/lib/scene";
import type { SceneInput } from "@/lib/scene/types";
import { anySceneInputArb, hostileSceneInputArb } from "../arbitraries";

const NUM_RUNS = 200;
const MIN_LEVEL = 1;
const MAX_LEVEL = 5;

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number") out.push(value);
  else if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) collectNumbers(child, out);
  }
  return out;
}

function expectValidModel(input: SceneInput): void {
  const model = buildSceneModel(input);
  expect(collectNumbers(model).every(Number.isFinite)).toBe(true);
  expect(Number.isInteger(model.level)).toBe(true);
  expect(model.level).toBeGreaterThanOrEqual(MIN_LEVEL);
  expect(model.level).toBeLessThanOrEqual(MAX_LEVEL);
  for (const window of model.windows) {
    expect(window.opacity).toBeGreaterThanOrEqual(0);
    expect(window.opacity).toBeLessThanOrEqual(1);
  }
}

describe("Property 3: no mutation and no throw on hostile numbers", () => {
  // **Validates: Requirements 3.5, 3.6, 10.7**
  it("never throws, returns a finite valid model and leaves the input equal to its clone", () => {
    fc.assert(
      fc.property(anySceneInputArb, (input) => {
        const before = structuredClone(input);
        expectValidModel(input);
        expect(input).toEqual(before);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // **Validates: Requirements 3.5, 3.6, 10.7**
  it("works on a deeply frozen hostile input (any write would throw)", () => {
    fc.assert(
      fc.property(hostileSceneInputArb, (input) => {
        const before = structuredClone(input);
        deepFreeze(input);
        expectValidModel(input);
        expect(input).toEqual(before);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
