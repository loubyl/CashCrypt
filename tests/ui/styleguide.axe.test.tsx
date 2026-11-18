import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it } from "vitest";
import { StyleguideContent } from "@/components/styleguide/StyleguideContent";
import { ToastRegion } from "@/components/ui/ToastRegion";
import { expectNoAxeViolations } from "./helpers/axe";

const AXE_TIMEOUT_MS = 30000;

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
});
