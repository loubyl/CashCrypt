import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("placeholder home page", () => {
  it("shows the CashCrypt wordmark in the wordmark font", () => {
    render(<Home />);
    const heading = screen.getByRole("heading", { level: 1, name: "CashCrypt" });
    expect(heading).toHaveClass("font-wordmark");
  });

  it("describes the product in one sentence", () => {
    render(<Home />);
    expect(
      screen.getByText("CashCrypt is a personal finance app where your money habits haunt your house."),
    ).toBeInTheDocument();
  });

  it("links to the styleguide", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "View the styleguide" })).toHaveAttribute(
      "href",
      "/styleguide",
    );
  });

  it("stays a Server Component", () => {
    const source = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(source).not.toMatch(/["']use client["']/);
  });
});
