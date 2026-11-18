import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BalanceHero, type BalanceHeroDelta } from "@/components/ui/BalanceHero";
import { setReducedMotion } from "./helpers/motion";

const LABEL = "Balance";

function getVisibleValue(container: HTMLElement): HTMLElement {
  return container.querySelector("[aria-hidden='true']") as HTMLElement;
}

describe("BalanceHero", () => {
  it("renders the label", () => {
    render(<BalanceHero label={LABEL} value={10} />);
    expect(screen.getByText(LABEL)).toBeInTheDocument();
  });

  it("splits a currency value into symbol, grouped integer and cents", () => {
    const { container } = render(<BalanceHero label={LABEL} value={1234.5} />);
    const visible = getVisibleValue(container);
    expect(visible).toHaveTextContent("$1,234.50");
    expect(visible.children).toHaveLength(3);
    expect(visible.children[0]).toHaveTextContent("$");
    expect(visible.children[1]).toHaveTextContent("1,234");
  });

  it("renders the cents at the smaller size class and the integer at full size", () => {
    const { container } = render(<BalanceHero label={LABEL} value={1234.5} />);
    const visible = getVisibleValue(container);
    expect(visible.children[2]).toHaveTextContent(".50");
    expect(visible.children[2].className).toContain("text-[0.6em]");
    expect(visible.children[1].className).not.toContain("text-[0.6em]");
  });

  it("shows the score as a floored whole number with no decimal point", () => {
    const { container } = render(<BalanceHero label={LABEL} value={39.9} format="score" />);
    const visible = getVisibleValue(container);
    expect(visible).toHaveTextContent("39");
    expect(visible.textContent).not.toContain(".");
    expect(visible.textContent).not.toContain("/100");
  });

  it("shows /100 only when showMax is set", () => {
    const { container, rerender } = render(<BalanceHero label={LABEL} value={39} format="score" />);
    expect(getVisibleValue(container)).not.toHaveTextContent("/100");

    rerender(<BalanceHero label={LABEL} value={39} format="score" showMax />);
    expect(getVisibleValue(container)).toHaveTextContent("39/100");
  });

  it("does not render a delta chip when no delta is given", () => {
    const { container } = render(<BalanceHero label={LABEL} value={10} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  const deltaCases: Array<[string, BalanceHeroDelta, string, string, string]> = [
    ["up and good", { direction: "up", intent: "good", amount: "$5.00" }, "+$5.00", "lucide-arrow-up", "text-ecto"],
    ["down and good", { direction: "down", intent: "good", amount: "$5.00" }, "−$5.00", "lucide-arrow-down", "text-ecto"],
    ["up and bad", { direction: "up", intent: "bad", amount: "$5.00" }, "+$5.00", "lucide-arrow-up", "text-blood"],
    ["down and bad", { direction: "down", intent: "bad", amount: "$5.00" }, "−$5.00", "lucide-arrow-down", "text-blood"],
  ];

  it.each(deltaCases)(
    "shows the sign text, arrow icon and tone for a delta that is %s",
    (_name, delta, text, iconClass, toneClass) => {
      const { container } = render(<BalanceHero label={LABEL} value={10} delta={delta} />);
      const chipText = screen.getByText(text);
      expect(chipText).toBeInTheDocument();
      const chip = chipText.parentElement as HTMLElement;
      expect(chip.className).toContain(toneClass);
      const icon = container.querySelector("svg") as SVGElement;
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon.getAttribute("class")).toContain(iconClass);
    },
  );

  it("exposes the final currency value to assistive technology", () => {
    const { container } = render(<BalanceHero label={LABEL} value={1234.5} />);
    expect(getVisibleValue(container)).toHaveAttribute("aria-hidden", "true");
    const text = container.querySelector(".sr-only") as HTMLElement;
    expect(text).toHaveTextContent("$1,234.50");
    expect(text).not.toHaveAttribute("aria-hidden");
  });

  it("exposes the final score to assistive technology, with 'out of 100' when showMax is set", () => {
    const { container, rerender } = render(<BalanceHero label={LABEL} value={39.9} format="score" />);
    expect(container.querySelector(".sr-only")).toHaveTextContent(/^39$/);

    rerender(<BalanceHero label={LABEL} value={39.9} format="score" showMax />);
    expect(container.querySelector(".sr-only")).toHaveTextContent("39 out of 100");
  });

  it("marks reduced motion as off by default", () => {
    render(<BalanceHero label={LABEL} value={10} data-testid="hero" />);
    expect(screen.getByTestId("hero")).toHaveAttribute("data-reduced-motion", "false");
  });

  it("shows the new value immediately when motion is reduced", () => {
    setReducedMotion(true);
    const { container, rerender } = render(
      <BalanceHero label={LABEL} value={10} data-testid="hero" />,
    );
    expect(screen.getByTestId("hero")).toHaveAttribute("data-reduced-motion", "true");
    expect(getVisibleValue(container)).toHaveTextContent("$10.00");

    rerender(<BalanceHero label={LABEL} value={250.75} data-testid="hero" />);
    expect(getVisibleValue(container)).toHaveTextContent("$250.75");
  });
});
