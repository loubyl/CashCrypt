import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { AppShell } from "@/components/shell/AppShell";
import { renderWithCrypt, resetNavigationMock, navigationSpies } from "./helpers/crypt";
import { resetViewport } from "./helpers/viewport";

vi.mock("next/navigation", async () => (await import("./helpers/crypt")).createNavigationMock());

const MOBILE_WIDTH = 1023;
const DESKTOP_WIDTH = 1024;
const MIN_TARGET_CLASSES = ["min-h-11", "min-w-11"];
const TAB_LABELS = ["Home", "Exorcism", "Subscriptions", "Debts", "Transactions"];

function renderShell(options: Parameters<typeof renderWithCrypt>[1]) {
  return renderWithCrypt(
    <AppShell>
      <main>
        <h1>Page content</h1>
      </main>
    </AppShell>,
    options,
  );
}

describe("navigation shell", () => {
  beforeEach(() => {
    resetNavigationMock();
  });

  afterEach(() => {
    cleanup();
    resetViewport();
  });

  it("shows the Tab_Bar with five tabs and a Settings icon link below 1024px", async () => {
    await renderShell({ mode: "demo", width: MOBILE_WIDTH, pathname: "/" });
    const nav = await screen.findByRole("navigation", { name: "Main" });
    const labels = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(labels).toEqual(TAB_LABELS);
    expect(nav.className).toContain("fixed");
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(within(nav).queryByRole("link", { name: "Settings" })).toBeNull();
  });

  it("shows the Sidebar with six destinations from 1024px", async () => {
    await renderShell({ mode: "demo", width: DESKTOP_WIDTH, pathname: "/" });
    const nav = await screen.findByRole("navigation", { name: "Main" });
    const labels = within(nav)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(labels).toEqual([...TAB_LABELS, "Settings"]);
    expect(nav.className).not.toContain("fixed");
  });

  it.each([MOBILE_WIDTH, DESKTOP_WIDTH])("renders exactly one nav element at %ipx", async (width) => {
    await renderShell({ mode: "demo", width, pathname: "/" });
    await screen.findByRole("navigation", { name: "Main" });
    expect(document.querySelectorAll("nav")).toHaveLength(1);
  });

  it.each([MOBILE_WIDTH, DESKTOP_WIDTH])(
    "marks only the active link with aria-current at %ipx",
    async (width) => {
      await renderShell({ mode: "demo", width, pathname: "/debts" });
      const nav = await screen.findByRole("navigation", { name: "Main" });
      const current = within(nav)
        .getAllByRole("link")
        .filter((link) => link.getAttribute("aria-current") === "page");
      expect(current.map((link) => link.textContent)).toEqual(["Debts"]);
    },
  );

  it("matches / exactly so Home is not active on another route", async () => {
    await renderShell({ mode: "demo", width: MOBILE_WIDTH, pathname: "/exorcism" });
    const home = await screen.findByRole("link", { name: "Home" });
    expect(home.getAttribute("aria-current")).toBeNull();
  });

  it("marks Home active on /", async () => {
    await renderShell({ mode: "demo", width: MOBILE_WIDTH, pathname: "/" });
    const home = await screen.findByRole("link", { name: "Home" });
    expect(home.getAttribute("aria-current")).toBe("page");
  });

  it("keeps a parent destination active on a nested path", async () => {
    await renderShell({ mode: "demo", width: MOBILE_WIDTH, pathname: "/debts/new" });
    const debts = await screen.findByRole("link", { name: "Debts" });
    expect(debts.getAttribute("aria-current")).toBe("page");
  });

  it.each([MOBILE_WIDTH, DESKTOP_WIDTH])("gives every nav link a 44px target at %ipx", async (width) => {
    await renderShell({ mode: "demo", width, pathname: "/" });
    await screen.findByRole("navigation", { name: "Main" });
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(TAB_LABELS.length);
    for (const link of links) {
      for (const cls of MIN_TARGET_CLASSES) expect(link.className).toContain(cls);
    }
  });

  it("redirects to / with router.replace when there is no Active_Crypt on another route", async () => {
    await renderShell({ width: MOBILE_WIDTH, pathname: "/debts" });
    await waitFor(() => expect(navigationSpies.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByText("Page content")).toBeNull();
  });

  it("does not redirect on / when there is no Active_Crypt", async () => {
    await renderShell({ width: MOBILE_WIDTH, pathname: "/" });
    expect(await screen.findByText("Page content")).toBeTruthy();
    expect(navigationSpies.replace).not.toHaveBeenCalled();
  });

  it("does not redirect when a crypt is active", async () => {
    await renderShell({ mode: "real", width: MOBILE_WIDTH, pathname: "/debts" });
    expect(await screen.findByText("Page content")).toBeTruthy();
    expect(navigationSpies.replace).not.toHaveBeenCalled();
  });

  it("shows the Demo mode chip only in demo mode", async () => {
    await renderShell({ mode: "demo", width: MOBILE_WIDTH, pathname: "/" });
    expect(await screen.findByText(/^Demo mode/)).toBeTruthy();
    cleanup();

    await renderShell({ mode: "real", width: MOBILE_WIDTH, pathname: "/" });
    await screen.findByRole("navigation", { name: "Main" });
    expect(screen.queryByText(/Demo mode/)).toBeNull();
  });

  it("shows the Demo mode chip in the Sidebar from 1024px", async () => {
    await renderShell({ mode: "demo", width: DESKTOP_WIDTH, pathname: "/" });
    expect(await screen.findByText(/^Demo mode/)).toBeTruthy();
  });

  it.each([MOBILE_WIDTH, DESKTOP_WIDTH])(
    "puts a Skip to content link first, visible only on focus, that moves focus to main at %ipx",
    async (width) => {
      const user = userEvent.setup();
      await renderShell({ mode: "demo", width, pathname: "/" });
      await screen.findByRole("navigation", { name: "Main" });
      const skip = screen.getByRole("link", { name: "Skip to content" });
      expect(skip.className).toContain("sr-only");
      expect(skip.className).toContain("focus:not-sr-only");
      await user.tab();
      expect(document.activeElement).toBe(skip);
      await user.keyboard("{Enter}");
      const main = screen.getByRole("main");
      expect(document.activeElement).toBe(main);
      expect(main.getAttribute("tabindex")).toBe("-1");
    },
  );

  it("puts the Skip to content link first on the Landing too, without the navigation", async () => {
    const user = userEvent.setup();
    await renderShell({ pathname: "/" });
    await screen.findByRole("heading", { name: "Page content" });
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Skip to content" }));
  });

  it("reserves bottom padding for the Tab_Bar below 1024px", async () => {
    await renderShell({ mode: "demo", width: MOBILE_WIDTH, pathname: "/" });
    const content = (await screen.findByText("Page content")).closest("main")?.parentElement;
    expect(content?.className).toContain("pb-[calc(4rem+env(safe-area-inset-bottom))]");
  });
});
