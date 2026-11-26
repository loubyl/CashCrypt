import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabBar } from "@/components/shell/TabBar";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const TAB_LABELS = ["Home", "Exorcism", "Subscriptions", "Debts", "Transactions"];
const EQUAL_WIDTH_CLASSES = ["flex-1", "basis-0"];
const NARROW_TRACKING_CLASS = "max-[359px]:tracking-tighter";

describe("TabBar", () => {
  afterEach(cleanup);

  it("keeps an accessible name and a visible label on every tab", () => {
    render(<TabBar />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const label of TAB_LABELS) {
      const link = within(nav).getByRole("link", { name: label });
      expect(link.textContent).toBe(label);
    }
  });

  it("gives every tab the same width classes and a 44px touch target", () => {
    render(<TabBar />);
    const links = within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link");
    expect(links).toHaveLength(TAB_LABELS.length);
    for (const link of links) {
      for (const cls of EQUAL_WIDTH_CLASSES) expect(link.classList.contains(cls)).toBe(true);
      expect(link.classList.contains("min-h-11")).toBe(true);
      expect(link.classList.contains(NARROW_TRACKING_CLASS)).toBe(true);
      const item = link.parentElement as HTMLElement;
      for (const cls of EQUAL_WIDTH_CLASSES) expect(item.classList.contains(cls)).toBe(true);
    }
  });
});
