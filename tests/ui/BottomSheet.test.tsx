import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { setReducedMotion } from "./helpers/motion";
import { setViewportWidth } from "./helpers/viewport";

const TITLE = "Log a payment";
const BELOW_DESKTOP_WIDTH = 1023;
const DESKTOP_WIDTH = 1024;

type HarnessProps = { onClose?: () => void; initialOpen?: boolean };

function Harness({ onClose, initialOpen = false }: HarnessProps) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      <BottomSheet
        open={open}
        title={TITLE}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      >
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </BottomSheet>
    </div>
  );
}

async function openSheet() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Open sheet" }));
  return user;
}

function getPanel(): HTMLElement {
  return screen.getByRole("dialog");
}

describe("BottomSheet", () => {
  afterEach(() => {
    document.body.querySelectorAll("[data-test-sibling]").forEach((node) => node.remove());
  });

  it("renders nothing while closed", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it("exposes a modal dialog named by its title", async () => {
    render(<Harness />);
    await openSheet();
    const dialog = screen.getByRole("dialog", { name: TITLE });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("names the close button 'Close'", async () => {
    render(<Harness />);
    await openSheet();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("portals the sheet into document.body", async () => {
    render(<Harness />);
    await openSheet();
    const layer = getPanel().parentElement;
    expect(layer?.parentElement).toBe(document.body);
  });

  it("moves focus into the dialog on open and back to the trigger on close", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open sheet" });
    const user = await openSheet();
    expect(getPanel().contains(document.activeElement)).toBe(true);
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("wraps Tab from the last focusable element to the first", async () => {
    render(<Harness />);
    const user = await openSheet();
    const close = screen.getByRole("button", { name: "Close" });
    screen.getByRole("button", { name: "Last action" }).focus();
    await user.tab();
    expect(close).toHaveFocus();
  });

  it("wraps Shift+Tab from the first focusable element to the last", async () => {
    render(<Harness />);
    const user = await openSheet();
    screen.getByRole("button", { name: "Close" }).focus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Last action" })).toHaveFocus();
  });

  it("calls onClose once on Escape", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const user = await openSheet();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose once on scrim click", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const user = await openSheet();
    const scrim = getPanel().parentElement?.querySelector<HTMLElement>("[aria-hidden='true'].bg-scrim");
    expect(scrim).toBeTruthy();
    await user.click(scrim as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose once on Close button click", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const user = await openSheet();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sets data-scroll-locked while open and removes it on close", async () => {
    render(<Harness />);
    const root = document.documentElement;
    expect(root).not.toHaveAttribute("data-scroll-locked");
    const user = await openSheet();
    expect(root).toHaveAttribute("data-scroll-locked");
    await user.keyboard("{Escape}");
    expect(root).not.toHaveAttribute("data-scroll-locked");
  });

  describe("inert background", () => {
    function addSibling(tag: string, attributes: Record<string, string> = {}): HTMLElement {
      const element = document.createElement(tag);
      element.setAttribute("data-test-sibling", "");
      for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
      }
      document.body.appendChild(element);
      return element;
    }

    it("sets inert only on ordinary siblings and restores them on close", async () => {
      const exempt = addSibling("div", { "data-inert-exempt": "" });
      const announcer = addSibling("next-route-announcer");
      const portal = addSibling("nextjs-portal");
      const upperPortal = addSibling("NEXTJS-PORTAL");
      const ordinary = addSibling("div");
      render(<Harness />);
      const user = await openSheet();

      expect(ordinary).toHaveAttribute("inert");
      for (const skipped of [exempt, announcer, portal, upperPortal]) {
        expect(skipped).not.toHaveAttribute("inert");
      }

      await user.keyboard("{Escape}");
      expect(ordinary).not.toHaveAttribute("inert");
    });

    it("keeps an element that was already inert before opening inert after closing", async () => {
      const preInert = addSibling("div", { inert: "" });
      render(<Harness />);
      const user = await openSheet();
      expect(preInert).toHaveAttribute("inert");
      await user.keyboard("{Escape}");
      expect(preInert).toHaveAttribute("inert");
    });
  });

  describe("viewport and motion", () => {
    function renderOpen() {
      render(<Harness initialOpen />);
      return getPanel();
    }

    it("slides up from the bottom below 1024px", () => {
      setViewportWidth(BELOW_DESKTOP_WIDTH);
      const panel = renderOpen();
      expect(panel.style.transform).toContain("translateY(100%)");
      expect(panel.style.transform).not.toContain("scale(0.96)");
    });

    it("fades and scales as a modal at 1024px", () => {
      setViewportWidth(DESKTOP_WIDTH);
      const panel = renderOpen();
      expect(panel.style.transform).toContain("scale(0.96)");
      expect(panel.style.transform).not.toContain("translateY(100%)");
    });

    it("reacts when the viewport crosses 1024px while mounted", () => {
      setViewportWidth(DESKTOP_WIDTH);
      renderOpen();
      act(() => setViewportWidth(BELOW_DESKTOP_WIDTH));
      expect(getPanel()).toBeInTheDocument();
    });

    it("flags reduced motion and keeps only a fade", () => {
      setReducedMotion(true);
      setViewportWidth(BELOW_DESKTOP_WIDTH);
      const panel = renderOpen();
      expect(panel.parentElement).toHaveAttribute("data-reduced-motion", "true");
      expect(panel.style.transform).not.toContain("translateY(100%)");
      expect(panel.style.transform).not.toContain("scale(0.96)");
    });

    it("flags full motion when reduced motion is off", () => {
      const panel = renderOpen();
      expect(panel.parentElement).toHaveAttribute("data-reduced-motion", "false");
    });
  });
});
