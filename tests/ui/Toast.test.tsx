import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toast } from "@/components/ui/Toast";
import { TOAST_DEFAULT_DURATION_MS, TOAST_RISE_PX } from "@/components/ui/motionTokens";
import { setReducedMotion } from "./helpers/motion";

const SHORT_DURATION_MS = 1000;
const HALF_DURATION_MS = 500;

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onDismiss once after the duration elapses", () => {
    const onDismiss = vi.fn();
    render(<Toast tone="success" message="Saved" duration={SHORT_DURATION_MS} onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(SHORT_DURATION_MS - 1);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(SHORT_DURATION_MS);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("uses the default duration when none is given", () => {
    const onDismiss = vi.fn();
    render(<Toast tone="info" message="Heads up" onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(TOAST_DEFAULT_DURATION_MS - 1);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("pauses the timer while the pointer is over the toast and resumes on leave", () => {
    const onDismiss = vi.fn();
    render(<Toast tone="success" message="Saved" duration={SHORT_DURATION_MS} onDismiss={onDismiss} />);
    const toast = screen.getByText("Saved").parentElement as HTMLElement;

    act(() => {
      vi.advanceTimersByTime(HALF_DURATION_MS);
    });
    fireEvent.pointerEnter(toast);
    act(() => {
      vi.advanceTimersByTime(SHORT_DURATION_MS * 5);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.pointerLeave(toast);
    act(() => {
      vi.advanceTimersByTime(HALF_DURATION_MS - 1);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("pauses the timer while focus is inside the toast and resumes when focus leaves", () => {
    const onDismiss = vi.fn();
    render(
      <div>
        <Toast
          tone="warning"
          message="Careful"
          duration={SHORT_DURATION_MS}
          actionLabel="Undo"
          onAction={() => undefined}
          onDismiss={onDismiss}
        />
        <button type="button">Outside</button>
      </div>,
    );

    act(() => {
      screen.getByRole("button", { name: "Undo" }).focus();
    });
    expect(screen.getByRole("button", { name: "Undo" })).toHaveFocus();
    act(() => {
      vi.advanceTimersByTime(SHORT_DURATION_MS * 5);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      screen.getByRole("button", { name: "Outside" }).focus();
    });
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
    act(() => {
      vi.advanceTimersByTime(SHORT_DURATION_MS);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onAction when the action button is pressed", () => {
    const onAction = vi.fn();
    render(
      <Toast tone="info" message="Moved" actionLabel="Undo" onAction={onAction} onDismiss={() => undefined} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("runs the action and then dismisses, each exactly once, even if clicked again or the timer elapses", () => {
    const calls: string[] = [];
    render(
      <Toast
        tone="info"
        message="Moved"
        duration={SHORT_DURATION_MS}
        actionLabel="Undo"
        onAction={() => calls.push("action")}
        onDismiss={() => calls.push("dismiss")}
      />,
    );
    const button = screen.getByRole("button", { name: "Undo" });
    fireEvent.click(button);
    fireEvent.click(button);
    act(() => {
      vi.advanceTimersByTime(SHORT_DURATION_MS * 2);
    });
    expect(calls).toEqual(["action", "dismiss"]);
  });

  it("still dismisses when the action throws", () => {
    const onDismiss = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // jsdom reports errors thrown in event handlers through the window "error" event.
    const reported: unknown[] = [];
    const onWindowError = (event: ErrorEvent) => {
      reported.push(event.error);
      event.preventDefault();
    };
    window.addEventListener("error", onWindowError);
    render(
      <Toast
        tone="info"
        message="Moved"
        actionLabel="Undo"
        onAction={() => {
          throw new Error("action failed");
        }}
        onDismiss={onDismiss}
      />,
    );
    try {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    } finally {
      window.removeEventListener("error", onWindowError);
      consoleError.mockRestore();
    }
    expect(reported).toHaveLength(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders no action button when no action label is given", () => {
    render(<Toast tone="info" message="Moved" onDismiss={() => undefined} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names the action button with actionAccessibleName while the visible label stays", () => {
    render(
      <Toast
        tone="info"
        message="Spotify canceled"
        actionLabel="Undo"
        actionAccessibleName="Undo: Spotify canceled"
        onAction={() => undefined}
        onDismiss={() => undefined}
      />,
    );
    const button = screen.getByRole("button", { name: "Undo: Spotify canceled" });
    expect(button).toHaveAttribute("aria-label", "Undo: Spotify canceled");
    expect(button).toHaveTextContent("Undo");
  });

  it("pauses on pointer hover and on focus for a toast with an action and a custom accessible name", () => {
    const onDismiss = vi.fn();
    render(
      <Toast
        tone="success"
        message="Payment saved"
        duration={SHORT_DURATION_MS}
        actionLabel="Undo"
        actionAccessibleName="Undo payment"
        onAction={() => undefined}
        onDismiss={onDismiss}
      />,
    );
    const toast = screen.getByText("Payment saved").parentElement as HTMLElement;

    fireEvent.pointerEnter(toast);
    act(() => {
      vi.advanceTimersByTime(SHORT_DURATION_MS * 5);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.pointerLeave(toast);

    act(() => {
      screen.getByRole("button", { name: "Undo payment" }).focus();
    });
    act(() => {
      vi.advanceTimersByTime(SHORT_DURATION_MS * 5);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("keeps the full long message in the DOM and lets it wrap", () => {
    const longMessage =
      "Payment of $1,250.00 saved to the Visa card, which lowers the balance and raises the light score by two points";
    render(<Toast tone="success" message={longMessage} onDismiss={() => undefined} />);
    const span = screen.getByText(longMessage);
    expect(span).toHaveTextContent(longMessage);
    expect(span.className).not.toContain("truncate");
    expect(span.className).not.toContain("whitespace-nowrap");
    expect(span.className).toContain("min-w-0");
    expect(span.className).toContain("text-pretty");
  });

  it("starts below its resting position when motion is allowed", () => {
    render(<Toast tone="success" message="Saved" onDismiss={() => undefined} />);
    const toast = screen.getByText("Saved").parentElement as HTMLElement;
    expect(toast).toHaveAttribute("data-reduced-motion", "false");
    expect(toast.style.transform).toContain(`${TOAST_RISE_PX}px`);
  });

  it("marks reduced motion and skips the rise when the user prefers reduced motion", () => {
    setReducedMotion(true);
    render(<Toast tone="success" message="Saved" onDismiss={() => undefined} />);
    const toast = screen.getByText("Saved").parentElement as HTMLElement;
    expect(toast).toHaveAttribute("data-reduced-motion", "true");
    expect(toast.style.transform).not.toContain(`${TOAST_RISE_PX}px`);
  });
});
