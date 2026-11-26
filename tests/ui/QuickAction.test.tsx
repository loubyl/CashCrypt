import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Plus } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { QuickAction } from "@/components/ui/QuickAction";
import { setReducedMotion } from "./helpers/motion";

describe("QuickAction", () => {
  it("renders a button whose accessible name is its label", () => {
    render(<QuickAction icon={Plus} label="Add expense" />);
    expect(screen.getByRole("button", { name: "Add expense" })).toBeInTheDocument();
  });

  it("activates once on Enter", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<QuickAction icon={Plus} label="Add" onClick={onClick} />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("activates once on Space", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<QuickAction icon={Plus} label="Add" onClick={onClick} />);
    await user.tab();
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ignores activation when disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<QuickAction icon={Plus} label="Add" disabled onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Add" });
    // Unavailable but focusable: `aria-disabled`, never the `disabled` attribute.
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");
    await user.click(button);
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    await user.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is not marked as reduced motion when the preference is off", () => {
    render(<QuickAction icon={Plus} label="Add" />);
    expect(screen.getByRole("button")).toHaveAttribute("data-reduced-motion", "false");
  });

  describe("with reduced motion", () => {
    it("marks the button reduced, applies no press scale and no icon wiggle", async () => {
      setReducedMotion(true);
      const onClick = vi.fn();
      render(<QuickAction icon={Plus} label="Add" onClick={onClick} />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("data-reduced-motion", "true");
      fireEvent.pointerDown(button);
      expect(button.style.transform ?? "").not.toContain("scale(0.97)");
      await userEvent.click(button);
      const iconWrapper = button.querySelector("svg")?.parentElement as HTMLElement;
      expect(iconWrapper.style.transform ?? "").not.toContain("rotate");
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});
