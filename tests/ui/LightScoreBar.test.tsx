import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LightScoreBar } from "@/components/ui/LightScoreBar";
import { setReducedMotion } from "./helpers/motion";

const LABEL = "Light score";

function getFill(meter: HTMLElement): HTMLElement {
  return meter.querySelector("[style*='width']") as HTMLElement;
}

describe("LightScoreBar", () => {
  it("exposes a meter with min, max, now and text attributes", () => {
    render(<LightScoreBar score={39} aria-label={LABEL} />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "100");
    expect(meter).toHaveAttribute("aria-valuenow", "39");
    expect(meter).toHaveAttribute("aria-valuetext", "Light score 39 of 100");
  });

  it("uses the aria-label as the accessible name", () => {
    render(<LightScoreBar score={50} aria-label="Your light score" />);
    expect(screen.getByRole("meter", { name: "Your light score" })).toBeInTheDocument();
  });

  it("shows the score as a floored whole number", () => {
    render(<LightScoreBar score={39.9} aria-label={LABEL} />);
    expect(screen.getByText("39")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "Light score 39 of 100");
  });

  it("shows the breakdown only when both baseScore and momentum are given", () => {
    const { rerender } = render(<LightScoreBar score={39} aria-label={LABEL} />);
    expect(screen.queryByText(/base/)).toBeNull();

    rerender(<LightScoreBar score={39} baseScore={33} aria-label={LABEL} />);
    expect(screen.queryByText(/base/)).toBeNull();

    rerender(<LightScoreBar score={39} momentum={6} aria-label={LABEL} />);
    expect(screen.queryByText(/momentum/)).toBeNull();

    rerender(<LightScoreBar score={39} baseScore={33} momentum={6} aria-label={LABEL} />);
    expect(screen.getByText("39 = 33 base + 6 momentum")).toBeInTheDocument();
  });

  it.each([
    [-20, "0"],
    [150, "100"],
    [Number.NaN, "0"],
    [Number.POSITIVE_INFINITY, "100"],
    [Number.NEGATIVE_INFINITY, "0"],
  ])("clamps a score of %s to %s", (score, expected) => {
    render(<LightScoreBar score={score} aria-label={LABEL} />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuenow", expected);
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(getFill(meter).style.width).toBe(`${expected}%`);
  });

  it("applies the fill immediately when motion is reduced", () => {
    setReducedMotion(true);
    render(<LightScoreBar score={64} aria-label={LABEL} />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("data-reduced-motion", "true");
    expect(getFill(meter).style.width).toBe("64%");
  });

  it("does not flag reduced motion by default", () => {
    render(<LightScoreBar score={64} aria-label={LABEL} />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-reduced-motion", "false");
  });

  it("requires an aria-label at the type level", () => {
    // @ts-expect-error aria-label is required
    render(<LightScoreBar score={10} />);
  });
});
