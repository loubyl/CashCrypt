import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Card, type CardHeadingLevel } from "@/components/ui/Card";

const HEADING_LEVELS: CardHeadingLevel[] = ["h1", "h2", "h3", "h4", "h5", "h6"];
const FORBIDDEN_CLASS_PATTERN = /(^|\s)(border|outline|shadow|ring)(-|\s|$)/;

describe("Card", () => {
  it("renders a titled card as a region named by its title", () => {
    render(<Card title="Debts">content</Card>);
    expect(screen.getByRole("region", { name: "Debts" })).toBeInTheDocument();
  });

  it("renders the title as an h2 heading by default", () => {
    render(<Card title="Debts" />);
    expect(screen.getByRole("heading", { level: 2, name: "Debts" })).toBeInTheDocument();
  });

  it.each(HEADING_LEVELS)("renders the title as %s when headingLevel is set", (level) => {
    render(<Card title="Debts" headingLevel={level} />);
    const expected = Number(level.slice(1));
    expect(screen.getByRole("heading", { level: expected, name: "Debts" })).toBeInTheDocument();
  });

  it("renders a link action whose name includes the card title", () => {
    render(<Card title="Debts" action={{ label: "See all", href: "/debts" }} />);
    const link = screen.getByRole("link", { name: "See all Debts" });
    expect(link).toHaveAccessibleName("See all Debts");
    expect(link).toHaveAttribute("href", "/debts");
  });

  it("renders a button action whose name includes the title and calls onClick", async () => {
    const onClick = vi.fn();
    render(<Card title="Debts" action={{ label: "See all", onClick }} />);
    const button = screen.getByRole("button", { name: "See all Debts" });
    expect(button).toHaveAccessibleName("See all Debts");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders an untitled card without a region role or heading", () => {
    render(<Card>plain</Card>);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("plain")).toBeInTheDocument();
  });

  it("does not render an action on an untitled card", () => {
    render(
      <Card action={{ label: "See all", href: "/x" }}>plain</Card>,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("uses no border, outline, ring or shadow classes", () => {
    const { container } = render(
      <Card title="Debts" action={{ label: "See all", href: "/debts" }}>
        content
      </Card>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("bg-surface-card");
    expect(root.className).toContain("rounded-lg");
    expect(root.className).not.toMatch(FORBIDDEN_CLASS_PATTERN);
  });

  it("uses no border classes on an untitled card", () => {
    const { container } = render(<Card>plain</Card>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toMatch(FORBIDDEN_CLASS_PATTERN);
  });
});
