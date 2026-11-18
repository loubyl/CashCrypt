import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastRegion, useToast, type ToastApi } from "@/components/ui/ToastRegion";
import { setReducedMotion } from "./helpers/motion";

const AUTO_DISMISS_MS = 100;

function Capture({ onApi }: { onApi: (api: ToastApi) => void }) {
  onApi(useToast());
  return null;
}

function renderRegion() {
  let api: ToastApi | null = null;
  render(
    <ToastRegion>
      <Capture
        onApi={(value) => {
          api = value;
        }}
      />
    </ToastRegion>,
  );
  if (api === null) {
    throw new Error("useToast did not return an api");
  }
  return api as ToastApi;
}

describe("ToastRegion", () => {
  beforeEach(() => {
    // Removal needs the exit animation to finish, so skip motion everywhere.
    setReducedMotion(true);
  });

  it("renders both live regions before any toast is shown", () => {
    renderRegion();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
    expect(within(screen.getByRole("status")).queryByText(/./)).toBeNull();
    expect(within(screen.getByRole("alert")).queryByText(/./)).toBeNull();
  });

  it.each(["success", "info"] as const)("places a %s toast in the status region", (tone) => {
    const api = renderRegion();
    act(() => {
      api.show({ tone, message: "Polite message" });
    });
    expect(within(screen.getByRole("status")).getByText("Polite message")).toBeInTheDocument();
    expect(within(screen.getByRole("alert")).queryByText("Polite message")).toBeNull();
  });

  it.each(["warning", "danger"] as const)("places a %s toast in the alert region", (tone) => {
    const api = renderRegion();
    act(() => {
      api.show({ tone, message: "Urgent message" });
    });
    expect(within(screen.getByRole("alert")).getByText("Urgent message")).toBeInTheDocument();
    expect(within(screen.getByRole("status")).queryByText("Urgent message")).toBeNull();
  });

  it("returns a distinct id from each show call", () => {
    const api = renderRegion();
    let first = "";
    let second = "";
    act(() => {
      first = api.show({ tone: "info", message: "One" });
      second = api.show({ tone: "info", message: "Two" });
    });
    expect(first).not.toBe("");
    expect(second).not.toBe("");
    expect(first).not.toBe(second);
  });

  it("removes a toast when dismissed by id", async () => {
    const api = renderRegion();
    let id = "";
    act(() => {
      id = api.show({ tone: "success", message: "Gone soon" });
    });
    expect(screen.getByText("Gone soon")).toBeInTheDocument();

    act(() => {
      api.dismiss(id);
    });
    await waitFor(() => expect(screen.queryByText("Gone soon")).toBeNull());
  });

  it("changes nothing when dismissing an unknown id", () => {
    const api = renderRegion();
    act(() => {
      api.show({ tone: "success", message: "Still here" });
    });
    act(() => {
      api.dismiss("toast-does-not-exist");
    });
    expect(screen.getByText("Still here")).toBeInTheDocument();
  });

  it("throws an error naming useToast and ToastRegion when used outside a region", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(() => render(<Capture onApi={() => undefined} />)).toThrow(/useToast.*ToastRegion/);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("calls the onAction handler passed to show when the action button is pressed", async () => {
    const onAction = vi.fn();
    const api = renderRegion();
    act(() => {
      api.show({ tone: "info", message: "Moved", actionLabel: "Undo", onAction });
    });
    await userEvent.setup().click(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("runs onAction once and removes that toast when the action is clicked", async () => {
    const onAction = vi.fn();
    const api = renderRegion();
    act(() => {
      api.show({ tone: "info", message: "Moved", actionLabel: "Undo", onAction });
      api.show({ tone: "info", message: "Other toast" });
    });
    const user = userEvent.setup();
    await user.dblClick(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText("Moved")).toBeNull());
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(screen.getByText("Other toast")).toBeInTheDocument();
  });

  it("marks toasts as reduced motion when the user prefers reduced motion", () => {
    const api = renderRegion();
    act(() => {
      api.show({ tone: "success", message: "Calm" });
    });
    expect(screen.getByText("Calm").parentElement).toHaveAttribute("data-reduced-motion", "true");
  });

  it("removes a toast by itself after its duration", async () => {
    const api = renderRegion();
    act(() => {
      api.show({ tone: "success", message: "Timed", duration: AUTO_DISMISS_MS });
    });
    expect(screen.getByText("Timed")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Timed")).toBeNull());
  });
});
