import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/AppShell";
import { renderWithCrypt, resetNavigationMock } from "./helpers/crypt";
import { resetViewport } from "./helpers/viewport";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const MOBILE_WIDTH = 320;
const DEMO_LABEL_PATTERN = /^Demo mode · \d{4}-\d{2}-\d{2}$/;

function renderShell() {
  return renderWithCrypt(
    <AppShell>
      <main>
        <h1>Page content</h1>
      </main>
    </AppShell>,
    { mode: "demo", width: MOBILE_WIDTH, pathname: "/" },
  );
}

describe("demo chip in the header", () => {
  beforeEach(() => {
    resetNavigationMock();
  });
  afterEach(() => {
    cleanup();
    resetViewport();
  });

  it("keeps the full text and the date in the accessible text", async () => {
    await renderShell();
    const banner = await screen.findByRole("banner");
    const full = await waitFor(() => within(banner).getByText(DEMO_LABEL_PATTERN));
    const date = full.textContent?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    expect(date).toBeTruthy();
    expect(full.textContent).toContain("Demo mode");
    expect(full.className).toContain("sr-only");
    expect(banner.querySelector(`[title="Demo mode · ${date}"]`)).not.toBeNull();
  });

  it("shows the short Demo text, hidden from assistive technology", async () => {
    await renderShell();
    const banner = await screen.findByRole("banner");
    const short = within(banner).getByText("Demo");
    expect(short.getAttribute("aria-hidden")).toBe("true");
    expect(short.className).toContain("sm:hidden");
  });

  it("keeps the Settings link named and protected from shrinking", async () => {
    await renderShell();
    const banner = await screen.findByRole("banner");
    const link = within(banner).getByRole("link", { name: "Settings" });
    expect(link.className).toContain("min-h-11");
    expect(link.className).toContain("min-w-11");
    expect(link.parentElement?.className).toContain("shrink-0");
  });
});
