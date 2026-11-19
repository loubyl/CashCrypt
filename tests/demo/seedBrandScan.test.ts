import { describe, expect, it } from "vitest";
import { buildScenario } from "@/lib/demo/seed";
import type { LocalDate, ScenarioId } from "@/types/finance";

const FORBIDDEN_BRAND_NAMES = [
  "Visa",
  "Mastercard",
  "Netflix",
  "Spotify",
  "Amazon",
  "Apple",
  "Disney",
  "Hulu",
  "YouTube",
] as const;

const SCENARIO_IDS: ScenarioId[] = [
  "level-1",
  "level-2",
  "level-3",
  "level-4",
  "level-5",
];
const DEMO_NOW = "2025-01-15" as LocalDate;
const WORD_CHARACTERS = "A-Za-z0-9_";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BRAND_PATTERNS = FORBIDDEN_BRAND_NAMES.map((brand) => ({
  brand,
  pattern: new RegExp(
    `(?<![${WORD_CHARACTERS}])${escapeRegExp(brand)}(?![${WORD_CHARACTERS}])`,
    "i",
  ),
}));

function findBrand(text: string): string | undefined {
  return BRAND_PATTERNS.find(({ pattern }) => pattern.test(text))?.brand;
}

/** Returns one message per seed row that contains a forbidden brand name. */
function scanScenario(id: ScenarioId): string[] {
  const data = buildScenario(id, DEMO_NOW);
  const rows: Array<{ rowId: string; kind: string; text: string }> = [
    ...data.debts.map((d) => ({ rowId: d.id, kind: "debt name", text: d.name })),
    ...data.subscriptions.map((s) => ({
      rowId: s.id,
      kind: "subscription name",
      text: s.name,
    })),
    ...data.transactions.map((t) => ({
      rowId: t.id,
      kind: "transaction description",
      text: t.description,
    })),
  ];
  return rows.flatMap(({ rowId, kind, text }) => {
    const brand = findBrand(text);
    return brand
      ? [`${id}: ${kind} "${text}" (row ${rowId}) contains "${brand}"`]
      : [];
  });
}

describe("seed brand scan", () => {
  it("detects a forbidden brand case-insensitively and by whole word", () => {
    expect(findBrand("my NETFLIX plan")).toBe("Netflix");
    expect(findBrand("Apple")).toBe("Apple");
    expect(findBrand("Pineapple")).toBeUndefined();
    expect(findBrand("Visas")).toBeUndefined();
  });

  it.each(SCENARIO_IDS)("%s has no real brand name in any row", (id) => {
    expect(scanScenario(id)).toEqual([]);
  });
});
