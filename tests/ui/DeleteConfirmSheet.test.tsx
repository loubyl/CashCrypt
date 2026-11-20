import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteConfirmSheet } from "@/components/sheets/DeleteConfirmSheet";
import { ToastRegion } from "@/components/ui/ToastRegion";
import type { MutationResult } from "@/hooks/useCryptActions";
import { setReducedMotion } from "./helpers/motion";

function renderSheet(onConfirm: () => Promise<MutationResult<void>>, onClose = vi.fn()) {
  render(
    <ToastRegion>
      <DeleteConfirmSheet
        open
        onClose={onClose}
        name="Wraithcast"
        confirmLabel="Delete subscription"
        onConfirm={onConfirm}
      />
    </ToastRegion>,
  );
  return onClose;
}

describe("DeleteConfirmSheet", () => {
  beforeEach(() => {
    setReducedMotion(true);
  });

  it("states what will be deleted and offers Keep it and the confirm label", () => {
    renderSheet(vi.fn());
    expect(screen.getByRole("dialog", { name: "Delete Wraithcast?" })).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep it" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete subscription" })).toBeInTheDocument();
  });

  it("closes without deleting on Keep it", async () => {
    const onConfirm = vi.fn();
    const onClose = renderSheet(onConfirm);
    await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes after a successful delete", async () => {
    const onConfirm = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const onClose = renderSheet(onConfirm);
    await userEvent.click(screen.getByRole("button", { name: "Delete subscription" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("stays open and shows an error on failure", async () => {
    const onConfirm = vi
      .fn()
      .mockResolvedValue({ ok: false, error: { kind: "unknown", message: "boom" } });
    const onClose = renderSheet(onConfirm);
    await userEvent.click(screen.getByRole("button", { name: "Delete subscription" }));
    await waitFor(() => expect(screen.getAllByText("Could not delete that. Try again.").length).toBeGreaterThan(0));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete subscription" })).toBeInTheDocument();
  });
});
