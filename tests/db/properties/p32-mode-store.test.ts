import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  MODE_STORAGE_KEY,
  readMode,
  writeMode,
  type Mode,
  type ModeStorage,
} from "@/lib/db/modeStore";

const NUM_RUNS = 100;

function createMemoryStorage(): ModeStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe("mode store", () => {
  // Feature: app-screens, Property 32: Unknown mode values read as empty
  // **Validates: Requirements 16.7**
  it("reads null for any stored string other than demo or real", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.constantFrom("", "Demo", "REAL", "DEMO", "Real", " demo", "real ")
        ),
        (value) => {
          fc.pre(value !== "demo" && value !== "real");
          const storage = createMemoryStorage();
          storage.setItem(MODE_STORAGE_KEY, value);
          expect(readMode(storage)).toBeNull();
        }
      ),
      { numRuns: NUM_RUNS }
    );
  });

  // Feature: app-screens, Property 32: Unknown mode values read as empty
  // **Validates: Requirements 16.7**
  it("reads back the written value for demo and real", () => {
    fc.assert(
      fc.property(fc.constantFrom<Mode>("demo", "real"), (mode) => {
        const storage = createMemoryStorage();
        writeMode(storage, mode);
        expect(readMode(storage)).toBe(mode);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  it("reads null when nothing is stored", () => {
    expect(readMode(createMemoryStorage())).toBeNull();
  });
});
