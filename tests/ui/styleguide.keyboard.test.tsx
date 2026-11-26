import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { StyleguideContent } from "@/components/styleguide/StyleguideContent";
import { ToastRegion } from "@/components/ui/ToastRegion";

// Requirements 21.1, 21.2, 21.4, 21.7, 21.8, 19.17.
// Requirement 21.8: the styleguide content is rendered inside a ToastRegion, never as the page.

const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "[tabindex]",
  "[role='button']",
  "[role='link']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='tab']",
  "[role='switch']",
  "[role='menuitem']",
].join(",");

/** Elements a Tab press can land on, in DOM order (all tabindex values here are 0 or -1). */
const TABBABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([type='hidden']):not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]",
].join(",");

/** Smallest Tailwind spacing step (rem * 4) whose width exceeds a 375px viewport (24rem = 384px). */
const MIN_OVERFLOW_STEP = 96;
const FIXED_ARBITRARY_WIDTH = /^(?:min-|max-)?w-\[\d+(?:px|rem)\]$/;
const FIXED_STEP_WIDTH = /^(?:min-)?w-(\d+)$/;

function renderStyleguide() {
  return render(
    <ToastRegion>
      <StyleguideContent />
    </ToastRegion>,
  );
}

function isHidden(element: Element): boolean {
  return element.closest("[hidden], [aria-hidden='true'], [inert]") !== null;
}

/** Text of the elements an aria-labelledby attribute points at. */
function labelledByText(element: Element): string {
  const ids = (element.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean);
  return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
}

/** Accessible name from aria-label, aria-labelledby, native labels, own text, or title. */
function accessibleName(element: Element): string {
  const labels = (element as HTMLInputElement).labels;
  const labelText = labels ? Array.from(labels).map((label) => label.textContent ?? "").join(" ") : "";
  const imageAlt = Array.from(element.querySelectorAll("img[alt]"))
    .map((image) => image.getAttribute("alt") ?? "")
    .join(" ");
  const candidates = [
    element.getAttribute("aria-label"),
    labelledByText(element),
    labelText,
    element.textContent,
    imageAlt,
    element.getAttribute("title"),
  ];
  return candidates.find((candidate) => (candidate ?? "").trim() !== "")?.trim() ?? "";
}

function tabbableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter((element) => {
    const tabindex = element.getAttribute("tabindex");
    if (tabindex !== null && Number(tabindex) < 0) return false;
    if (element.matches(":disabled")) return false;
    return !isHidden(element);
  });
}

describe("styleguide keyboard and structure", () => {
  it("moves focus through every enabled control in DOM order and skips disabled ones", async () => {
    const user = userEvent.setup();
    const { container } = renderStyleguide();
    const expected = tabbableElements(container);
    expect(expected.length).toBeGreaterThan(0);

    const visited: Element[] = [];
    for (let index = 0; index < expected.length; index += 1) {
      await user.tab();
      visited.push(document.activeElement as Element);
    }

    expect(visited).toEqual(expected);
    for (const element of visited) {
      expect(element).not.toBeDisabled();
      // A loading Button and an unavailable QuickAction are aria-disabled but stay focusable on
      // purpose, so keyboard focus is not lost when they become unavailable (action-feedback
      // Requirement 15). Every other aria-disabled control must be skipped.
      const keepsFocus =
        element.getAttribute("aria-busy") === "true" || element.closest('section[aria-labelledby="styleguide-quickaction"]') !== null;
      if (!keepsFocus) {
        expect(element.getAttribute("aria-disabled")).not.toBe("true");
      }
    }
  }, 15000); // Tabs through every control; slow when the full suite runs in parallel.

  it("renders no tabindex greater than 0", () => {
    const { container } = renderStyleguide();
    const offenders = Array.from(container.querySelectorAll("[tabindex]")).filter(
      (element) => Number(element.getAttribute("tabindex")) > 0,
    );
    expect(offenders).toEqual([]);
  });

  it("renders exactly one main landmark and one h1", () => {
    const { container } = renderStyleguide();
    expect(container.querySelectorAll("main, [role='main']")).toHaveLength(1);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("never skips a heading level", () => {
    const { container } = renderStyleguide();
    const levels = Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((heading) =>
      Number(heading.tagName.slice(1)),
    );
    expect(levels[0]).toBe(1);
    levels.forEach((level, index) => {
      if (index === 0) return;
      expect(level, `heading #${index} jumps from h${levels[index - 1]} to h${level}`).toBeLessThanOrEqual(
        levels[index - 1] + 1,
      );
    });
  });

  it("gives every interactive element an accessible name", () => {
    const { container } = renderStyleguide();
    const interactive = Array.from(container.querySelectorAll(INTERACTIVE_SELECTOR)).filter(
      (element) => !isHidden(element),
    );
    expect(interactive.length).toBeGreaterThan(0);
    const unnamed = interactive
      .filter((element) => accessibleName(element) === "")
      .map((element) => element.outerHTML.slice(0, 120));
    expect(unnamed).toEqual([]);
  });

  it("uses no fixed width class that could exceed a 375px viewport", () => {
    const { container } = renderStyleguide();
    const offenders: string[] = [];
    container.querySelectorAll("[class]").forEach((element) => {
      const classes = (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
      for (const token of classes) {
        // Prefixed utilities (lg:, sm:, hover:) are not the base layout.
        if (token.includes(":")) continue;
        const step = FIXED_STEP_WIDTH.exec(token);
        const fixedStep = step !== null && Number(step[1]) >= MIN_OVERFLOW_STEP;
        if (FIXED_ARBITRARY_WIDTH.test(token) || fixedStep) offenders.push(token);
      }
    });
    expect(offenders).toEqual([]);
  });
});
