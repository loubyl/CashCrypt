import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StyleguideContent } from "@/components/styleguide/StyleguideContent";
import { ToastRegion } from "@/components/ui/ToastRegion";

// Requirement 19.5: one section per primitive, in this order. Unbuilt primitives are omitted.
const REQUIRED_ORDER = [
  "Button",
  "QuickAction",
  "BalanceHero",
  "Card",
  "ListRow",
  "Chip",
  "SegmentedControl",
  "Input",
  "BottomSheet",
  "Toast",
  "LightScoreBar",
  "ExorcismActionRow",
] as const;

const TOKENS_HEADING = "Tokens";
const SECTION_ID_PREFIX = "styleguide-";
const UI_DIR = join(process.cwd(), "src", "components", "ui");

/** A primitive counts as built when its component file exists in src/components/ui. */
const builtPrimitives = REQUIRED_ORDER.filter((name) => existsSync(join(UI_DIR, `${name}.tsx`)));

/** The root layout provides the ToastRegion on the real page; the styleguide must not mount its own. */
function renderStyleguide() {
  render(
    <ToastRegion>
      <StyleguideContent />
    </ToastRegion>,
  );
}

/**
 * Headings of the styleguide's own sections, in document order. Each section is a
 * <section aria-labelledby> region pointing at its heading. Example components inside a
 * section (for example Card titles) render their own headings, which are not counted.
 */
function sectionHeadings(): string[] {
  return screen
    .getAllByRole("region")
    .filter((region) => region.getAttribute("aria-labelledby")?.startsWith(SECTION_ID_PREFIX))
    .map((region) => {
      const heading = document.getElementById(region.getAttribute("aria-labelledby") ?? "");
      return heading?.textContent ?? "";
    });
}

describe("styleguide section order", () => {
  it("starts with the Tokens section", () => {
    renderStyleguide();
    expect(sectionHeadings()[0]).toBe(TOKENS_HEADING);
  });

  it("renders one section per built primitive, in the Requirement 19.5 order", () => {
    renderStyleguide();
    const primitiveHeadings = sectionHeadings().filter((title) => title !== TOKENS_HEADING);
    expect(primitiveHeadings).toEqual(builtPrimitives);
  });

  it("uses h2 only for section headings, so example Cards sit one level below as h3", () => {
    renderStyleguide();
    const sectionTitles = sectionHeadings();
    const h2Titles = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent ?? "");
    expect(h2Titles).toEqual(sectionTitles);
    expect(screen.getByRole("heading", { level: 3, name: "Subscriptions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Debts" })).toBeInTheDocument();
  });
});
