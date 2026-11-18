import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Plus } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { setReducedMotion } from "./helpers/motion";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "danger"];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];
const SUCCESS_REGION_SELECTOR = '[aria-live="polite"]';

describe("Button", () => {
  it("renders a button role with its label as the accessible name", () => {
    render(<Button>Save payment</Button>);
    expect(screen.getByRole("button", { name: "Save payment" })).toBeInTheDocument();
  });

  it.each(VARIANTS)("reflects the %s variant in the output", (variant) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-variant", variant);
  });

  it.each(SIZES)("reflects the %s size in the output", (size) => {
    render(<Button size={size}>Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-size", size);
  });

  it("uses primary and md by default", () => {
    render(<Button>Go</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "primary");
    expect(button).toHaveAttribute("data-size", "md");
  });

  it("defaults to type button and accepts submit", () => {
    const { rerender } = render(<Button>Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
    rerender(<Button type="submit">Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("does not call onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not call onClick while loading and sets aria-busy", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Go
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("omits aria-busy when not loading", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
  });

  it("activates once on Enter", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Go</Button>);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("activates once on Space", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Go</Button>);
    await user.tab();
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("announces the success text in a polite live region when success turns on", () => {
    const { container, rerender } = render(<Button successAnnouncement="Payment saved">Go</Button>);
    const region = container.querySelector(SUCCESS_REGION_SELECTOR);
    expect(region).not.toBeNull();
    expect(region).toHaveTextContent("");
    act(() => {
      rerender(
        <Button success successAnnouncement="Payment saved">
          Go
        </Button>,
      );
    });
    expect(container.querySelector(SUCCESS_REGION_SELECTOR)).toHaveTextContent("Payment saved");
  });

  it("requires an aria-label on an icon-only button", () => {
    // @ts-expect-error icon-only buttons must have an aria-label
    render(<Button leadingIcon={Plus} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("names an icon-only button through its aria-label", () => {
    render(<Button leadingIcon={Plus} aria-label="Add expense" />);
    expect(screen.getByRole("button", { name: "Add expense" })).toBeInTheDocument();
  });

  describe("with reduced motion", () => {
    it("marks the button as reduced motion and configures no press scale", () => {
      setReducedMotion(true);
      render(<Button>Go</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("data-reduced-motion", "true");
      fireEvent.pointerDown(button);
      expect(button.style.transform ?? "").not.toContain("scale(0.97)");
    });

    it("still calls onClick once and ignores clicks while disabled", async () => {
      setReducedMotion(true);
      const onClick = vi.fn();
      const { rerender } = render(<Button onClick={onClick}>Go</Button>);
      await userEvent.click(screen.getByRole("button"));
      expect(onClick).toHaveBeenCalledTimes(1);
      rerender(
        <Button disabled onClick={onClick}>
          Go
        </Button>,
      );
      await userEvent.click(screen.getByRole("button"));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("keeps aria-busy and the success announcement", () => {
      setReducedMotion(true);
      const { container, rerender } = render(<Button loading>Go</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
      act(() => {
        rerender(
          <Button success successAnnouncement="Saved">
            Go
          </Button>,
        );
      });
      expect(container.querySelector(SUCCESS_REGION_SELECTOR)).toHaveTextContent("Saved");
    });
  });

  it("marks the button as not reduced when the preference is off", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-reduced-motion", "false");
  });
});
