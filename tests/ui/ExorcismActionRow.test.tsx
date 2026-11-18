import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExorcismActionRow } from "@/components/ui/ExorcismActionRow";
import { setReducedMotion } from "./helpers/motion";

const TITLE = "Cancel StreamMax";
const CHECKBOX_NAME = `Mark "${TITLE}" as done`;

type RowOverrides = Partial<Parameters<typeof ExorcismActionRow>[0]>;

function renderRow(overrides: RowOverrides = {}) {
  const onToggle = vi.fn();
  const utils = render(
    <ExorcismActionRow
      id="row-1"
      title={TITLE}
      impactText="$22.99"
      done={false}
      onToggle={onToggle}
      {...overrides}
    />,
  );
  return { onToggle, ...utils };
}

describe("ExorcismActionRow", () => {
  it("exposes a checkbox whose accessible name includes the title", () => {
    renderRow();
    const checkbox = screen.getByRole("checkbox", { name: CHECKBOX_NAME });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it("calls onToggle once with true when clicked while open", async () => {
    const { onToggle } = renderRow();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("calls onToggle once with true when Space is pressed on the focused checkbox", async () => {
    const user = userEvent.setup();
    const { onToggle } = renderRow();
    await user.tab();
    expect(screen.getByRole("checkbox")).toHaveFocus();
    await user.keyboard(" ");
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("calls onToggle with false when a done row is clicked or toggled with Space", async () => {
    const user = userEvent.setup();
    const { onToggle } = renderRow({ done: true });
    await user.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenLastCalledWith(false);
    await user.keyboard(" ");
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });

  it("shows a checked checkbox and a struck-through title when done", () => {
    renderRow({ done: true });
    expect(screen.getByRole("checkbox", { name: CHECKBOX_NAME })).toBeChecked();
    expect(screen.getByText(TITLE)).toHaveClass("line-through");
  });

  it("does not strike through the title when open", () => {
    renderRow();
    expect(screen.getByText(TITLE)).not.toHaveClass("line-through");
  });

  it("ignores click and Space when disabled", async () => {
    const user = userEvent.setup();
    const { onToggle } = renderRow({ disabled: true });
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();
    await user.click(checkbox);
    checkbox.focus();
    await user.keyboard(" ");
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("formats the impact as a plus sign, the amount and /mo", () => {
    renderRow({ impactText: "$22.99" });
    expect(screen.getByText("+$22.99/mo")).toBeInTheDocument();
  });

  it("dims the impact amount to tertiary when done and keeps its text", () => {
    renderRow({ done: true });
    const impact = screen.getByText("+$22.99/mo");
    expect(impact).toHaveClass("text-ink-tertiary");
    expect(impact).not.toHaveClass("text-ecto");
  });

  it("shows the impact amount in ecto when open", () => {
    renderRow();
    const impact = screen.getByText("+$22.99/mo");
    expect(impact).toHaveClass("text-ecto");
    expect(impact).not.toHaveClass("text-ink-tertiary");
  });

  it("renders the subtitle only when one is given", () => {
    const { rerender, onToggle } = renderRow();
    expect(screen.queryByText("Streaming")).toBeNull();
    rerender(
      <ExorcismActionRow
        id="row-1"
        title={TITLE}
        subtitle="Streaming"
        impactText="$22.99"
        done={false}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByText("Streaming")).toBeInTheDocument();
  });

  describe("with reduced motion", () => {
    it("marks the row as reduced motion and keeps the checkbox working", async () => {
      setReducedMotion(true);
      const { container, onToggle } = renderRow();
      expect(container.querySelector("[data-reduced-motion='true']")).not.toBeNull();
      await userEvent.click(screen.getByRole("checkbox"));
      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledWith(true);
    });

    it("marks the row as not reduced by default", () => {
      const { container } = renderRow();
      expect(container.querySelector("[data-reduced-motion='false']")).not.toBeNull();
    });

    it("keeps the done styling", () => {
      setReducedMotion(true);
      renderRow({ done: true });
      expect(screen.getByRole("checkbox")).toBeChecked();
      expect(screen.getByText(TITLE)).toHaveClass("line-through");
    });
  });
});
