import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it } from "vitest";
import { StyleguideContent } from "@/components/styleguide/StyleguideContent";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { expectNoAxeViolations } from "./helpers/axe";

const AXE_TIMEOUT_MS = 30000;

// Messages match the TOAST_TRIGGERS in StyleguideContent. The rendered toasts are real, triggered by the real buttons.
const TOAST_CASES = [
  { tone: "success", message: "+$11.99/mo saved" },
  { tone: "info", message: "Small expenses are up this week" },
  { tone: "warning", message: "Visa card payment is due in 3 days" },
  { tone: "danger", message: "Payment could not be saved" },
] as const;

function renderStyleguide() {
  return render(
    <ToastRegion>
      <StyleguideContent />
    </ToastRegion>,
  );
}

describe("styleguide accessibility (axe)", () => {
  it(
    "has no axe violations with the sheet closed",
    async () => {
      renderStyleguide();
      await expectNoAxeViolations(document.body);
    },
    AXE_TIMEOUT_MS,
  );

  it(
    "has no axe violations with the sheet open",
    async () => {
      const user = userEvent.setup();
      renderStyleguide();
      await user.click(screen.getByRole("button", { name: "Open sheet" }));
      await screen.findByRole("dialog", { name: "Log a payment" });
      await expectNoAxeViolations(document.body);
    },
    AXE_TIMEOUT_MS,
  );

  it.each(TOAST_CASES)(
    "has no axe violations with the $tone toast visible",
    async ({ tone, message }) => {
      const user = userEvent.setup();
      renderStyleguide();
      await user.click(screen.getByRole("button", { name: `Show ${tone} toast` }));
      await screen.findByText(message);
      await expectNoAxeViolations(document.body);
    },
    AXE_TIMEOUT_MS,
  );
});
