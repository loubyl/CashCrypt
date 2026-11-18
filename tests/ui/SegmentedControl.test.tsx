import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/SegmentedControl";
import { setReducedMotion } from "./helpers/motion";

const LABEL = "Period";

const OPTIONS: readonly SegmentedControlOption[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const OPTIONS_WITH_DISABLED: readonly SegmentedControlOption[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week", disabled: true },
  { value: "month", label: "Month" },
];

function Controlled({
  options = OPTIONS,
  initial = "day",
  onChange,
}: {
  options?: readonly SegmentedControlOption[];
  initial?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <SegmentedControl
      aria-label={LABEL}
      options={options}
      value={value}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

describe("SegmentedControl", () => {
  it("renders a radiogroup with an accessible name and radio segments", () => {
    render(<Controlled />);
    expect(screen.getByRole("radiogroup", { name: LABEL })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("supports aria-labelledby as the accessible name", () => {
    render(
      <>
        <span id="lbl">Range</span>
        <SegmentedControl aria-labelledby="lbl" options={OPTIONS} value="day" onChange={() => {}} />
      </>,
    );
    expect(screen.getByRole("radiogroup", { name: "Range" })).toBeInTheDocument();
  });

  it("marks only the selected segment as checked", () => {
    render(<Controlled initial="week" />);
    expect(screen.getByRole("radio", { name: "Day" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "Week" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Month" })).toHaveAttribute("aria-checked", "false");
  });

  it("uses a roving tabindex on the selected segment", () => {
    render(<Controlled initial="week" />);
    expect(screen.getByRole("radio", { name: "Day" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("radio", { name: "Week" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Month" })).toHaveAttribute("tabindex", "-1");
  });

  it("puts the tab stop on the first enabled segment when nothing is selected", () => {
    render(
      <SegmentedControl
        aria-label={LABEL}
        options={[{ value: "a", label: "A", disabled: true }, ...OPTIONS]}
        value="none"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("radio", { name: "A" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("radio", { name: "Day" })).toHaveAttribute("tabindex", "0");
  });

  it("moves focus and selection with arrow keys and updates the tab stop", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.tab();
    expect(screen.getByRole("radio", { name: "Day" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Week" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Week" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Week" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Day" })).toHaveAttribute("tabindex", "-1");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Month" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Week" })).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("radio", { name: "Day" })).toHaveFocus();
  });

  it("wraps around at both ends", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.tab();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Month" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Month" })).toHaveAttribute("aria-checked", "true");

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Day" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Day" })).toHaveAttribute("aria-checked", "true");
  });

  it("jumps to the first and last segments with Home and End", async () => {
    const user = userEvent.setup();
    render(<Controlled initial="week" />);
    await user.tab();
    expect(screen.getByRole("radio", { name: "Week" })).toHaveFocus();

    await user.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "Month" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Month" })).toHaveAttribute("aria-checked", "true");

    await user.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "Day" })).toHaveFocus();
    expect(screen.getByRole("radio", { name: "Day" })).toHaveAttribute("aria-checked", "true");
  });

  it("skips a disabled segment during keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<Controlled options={OPTIONS_WITH_DISABLED} />);
    await user.tab();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Month" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Day" })).toHaveFocus();
  });

  it("does not select a disabled segment on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled options={OPTIONS_WITH_DISABLED} onChange={onChange} />);
    const disabled = screen.getByRole("radio", { name: "Week" });
    expect(disabled).toBeDisabled();

    await user.click(disabled);
    expect(onChange).not.toHaveBeenCalled();
    expect(disabled).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange once per change and not for the selected segment", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "Month" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("month");

    await user.click(screen.getByRole("radio", { name: "Month" }));
    expect(onChange).toHaveBeenCalledTimes(1);

    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith("week");
  });

  it("flags reduced motion on the group when preferred", () => {
    setReducedMotion(true);
    render(<Controlled />);
    expect(screen.getByRole("radiogroup")).toHaveAttribute("data-reduced-motion", "true");
  });

  it("does not flag reduced motion by default", () => {
    render(<Controlled />);
    expect(screen.getByRole("radiogroup")).toHaveAttribute("data-reduced-motion", "false");
  });

  it("requires an accessible name at the type level", () => {
    // @ts-expect-error aria-label or aria-labelledby is required
    render(<SegmentedControl options={OPTIONS} value="day" onChange={() => {}} />);
  });
});
