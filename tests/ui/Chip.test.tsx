import { render, screen } from "@testing-library/react";
import { Flame } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Chip, type ChipAccentTone } from "@/components/ui/Chip";

const ACCENT_TONES: ChipAccentTone[] = ["success", "warning", "danger", "info", "spirit"];

describe("Chip", () => {
  it.each(ACCENT_TONES)("renders the label for the %s tone", (tone) => {
    render(
      <Chip tone={tone} icon={Flame}>
        Label text
      </Chip>,
    );
    expect(screen.getByText("Label text")).toBeInTheDocument();
  });

  it("renders the label for the neutral tone without an icon", () => {
    const { container } = render(<Chip tone="neutral">Neutral label</Chip>);
    expect(screen.getByText("Neutral label")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it.each(ACCENT_TONES)("renders a decorative icon hidden from assistive tech for the %s tone", (tone) => {
    const { container } = render(
      <Chip tone={tone} icon={Flame}>
        Label text
      </Chip>,
    );
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("renders an optional icon on the neutral tone as aria-hidden", () => {
    const { container } = render(
      <Chip tone="neutral" icon={Flame}>
        Neutral label
      </Chip>,
    );
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("rejects a colored tone without an icon at compile time", () => {
    // @ts-expect-error icon is required for every tone except neutral
    const element = <Chip tone="danger">No icon</Chip>;
    expect(element.props.tone).toBe("danger");
  });
});
