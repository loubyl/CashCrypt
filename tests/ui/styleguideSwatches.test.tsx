import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StyleguideContent } from "@/components/styleguide/StyleguideContent";
import { ToastRegion } from "@/components/ui/ToastRegion";

const SAMPLE_TEXT = "Aa";

// The root layout mounts ToastRegion, so the Toast section needs it here too.
function renderStyleguide() {
  return render(
    <ToastRegion>
      <StyleguideContent />
    </ToastRegion>,
  );
}

// Each swatch row shows the token name next to its "Aa" sample.
function sampleFor(token: string): HTMLElement {
  const row = screen.getByText(token).closest("li");
  if (!row) throw new Error(`No swatch row for ${token}`);
  const sample = [...row.querySelectorAll("span")].find((el) => el.textContent === SAMPLE_TEXT);
  if (!sample) throw new Error(`No "${SAMPLE_TEXT}" sample for ${token}`);
  return sample;
}

describe("styleguide token swatches", () => {
  it.each(["--surface-void", "--surface-card", "--surface-raised", "--surface-overlay"])(
    "draws the sample on the dark %s swatch in ink",
    (token) => {
      renderStyleguide();
      const sample = sampleFor(token);
      expect(sample).toHaveClass("text-ink");
      expect(sample).not.toHaveClass("text-on-accent");
    },
  );

  it.each([
    "--text-primary",
    "--text-secondary",
    "--text-tertiary",
    "--accent-candle",
    "--accent-ecto",
    "--accent-blood",
    "--accent-ghost",
    "--accent-spirit",
  ])("draws the sample on the light %s swatch in on-accent, never ink", (token) => {
    renderStyleguide();
    const sample = sampleFor(token);
    expect(sample).toHaveClass("text-on-accent");
    expect(sample.className).not.toMatch(/\btext-ink(-secondary|-tertiary)?\b/);
  });
});
