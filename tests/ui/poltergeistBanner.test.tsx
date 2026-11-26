// Poltergeist banner pulse (action-feedback Requirements 4.3, 4.9).
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PoltergeistBanner } from "@/components/dashboard/PoltergeistBanner";
import { setReducedMotion } from "./helpers/motion";

const AMOUNT_SELECTOR = '[data-part="banner-amount"]';
const TOTAL_CENTS = 4150;

function pulsing(container: HTMLElement): string | null | undefined {
  return container.querySelector(AMOUNT_SELECTOR)?.getAttribute("data-pulsing");
}

afterEach(() => {
  cleanup();
  setReducedMotion(false);
});

describe("PoltergeistBanner pulse", () => {
  it("starts the emphasis when the pulse key changes", () => {
    const { container, rerender } = render(<PoltergeistBanner smallExpenseTotalCents={TOTAL_CENTS} pulseKey={0} />);
    expect(pulsing(container)).toBe("false");
    act(() => {
      rerender(<PoltergeistBanner smallExpenseTotalCents={TOTAL_CENTS} pulseKey={1} />);
    });
    expect(pulsing(container)).toBe("true");
  });

  it("does nothing under reduced motion", () => {
    setReducedMotion(true);
    const { container, rerender } = render(<PoltergeistBanner smallExpenseTotalCents={TOTAL_CENTS} pulseKey={0} />);
    act(() => {
      rerender(<PoltergeistBanner smallExpenseTotalCents={TOTAL_CENTS} pulseKey={1} />);
    });
    expect(pulsing(container)).toBe("false");
  });

  it("does not pulse when the key is unchanged, as for a ghost arrival that only changes the total", () => {
    const { container, rerender } = render(<PoltergeistBanner smallExpenseTotalCents={TOTAL_CENTS} pulseKey={2} />);
    act(() => {
      rerender(<PoltergeistBanner smallExpenseTotalCents={TOTAL_CENTS + 500} pulseKey={2} />);
    });
    expect(pulsing(container)).toBe("false");
  });
});
