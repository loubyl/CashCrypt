import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StyleguideContent } from "@/components/styleguide/StyleguideContent";
import { ToastRegion } from "@/components/ui/ToastRegion";

describe("styleguide row highlight", () => {
  it("renders a highlighted ListRow and a highlighted ExorcismActionRow with visible tags", () => {
    render(
      <ToastRegion>
        <StyleguideContent />
      </ToastRegion>,
    );
    const listRow = screen.getByText("ListRow, highlighted (New and Updated tags)").parentElement as HTMLElement;
    expect(within(listRow).getByText("New")).toBeInTheDocument();
    expect(within(listRow).getByText("Updated")).toBeInTheDocument();
    const exorcism = screen.getByText("ExorcismActionRow, highlighted").parentElement as HTMLElement;
    expect(within(exorcism).getByText("New")).toBeInTheDocument();
  });
});
