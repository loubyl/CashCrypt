import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("ui test project", () => {
  it("renders JSX in jsdom", () => {
    const { container } = render(<div data-testid="smoke" />);
    expect(container.querySelector("div")).toBeInTheDocument();
  });
});
