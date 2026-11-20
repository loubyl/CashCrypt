import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Ghost } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { ListRow } from "@/components/ui/ListRow";

const MINUS_SIGN = "\u2212";
const DIVIDER_CLASS = "after:bg-divider";

describe("ListRow", () => {
  it("renders the title and the subtitle", () => {
    render(<ListRow icon={Ghost} title="Coffee" subtitle="Yesterday" />);
    expect(screen.getByText("Coffee")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });

  it("renders a badge inside the row, so the focus ring encloses it, and grows instead of a fixed height", () => {
    render(
      <ListRow icon={Ghost} title="Coffee" subtitle="Yesterday" badge={<span>Paid off</span>} onClick={() => {}} />,
    );
    const row = screen.getByRole("button");
    expect(row.contains(screen.getByText("Paid off"))).toBe(true);
    expect(row).toHaveClass("min-h-16", "py-2");
    expect(row).not.toHaveClass("h-16");
  });

  it("omits the subtitle when none is given", () => {
    const { container } = render(<ListRow icon={Ghost} title="Coffee" />);
    expect(container.textContent).toBe("Coffee");
  });

  it("renders a static row with no button or link role", () => {
    render(<ListRow icon={Ghost} title="Coffee" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a button row when onClick is given", () => {
    render(<ListRow icon={Ghost} title="Coffee" onClick={() => {}} />);
    const button = screen.getByRole("button", { name: "Coffee" });
    expect(button).toHaveAttribute("type", "button");
  });

  it("renders a link row when href is given", () => {
    render(<ListRow icon={Ghost} title="Coffee" href="/transactions" />);
    expect(screen.getByRole("link", { name: "Coffee" })).toHaveAttribute("href", "/transactions");
  });

  it("shows a plus sign before an incoming amount", () => {
    render(<ListRow icon={Ghost} title="Refund" amount="$22.99" amountDirection="in" />);
    expect(screen.getByText("+$22.99")).toBeInTheDocument();
  });

  it("shows a minus sign before an outgoing amount", () => {
    render(<ListRow icon={Ghost} title="Coffee" amount="$4.50" amountDirection="out" />);
    expect(screen.getByText(`${MINUS_SIGN}$4.50`)).toBeInTheDocument();
  });

  it("shows the amount without a sign when no direction is given", () => {
    render(<ListRow icon={Ghost} title="Balance" amount="$10.00" />);
    expect(screen.getByText("$10.00")).toBeInTheDocument();
  });

  it("draws the divider only when requested", () => {
    const { container, rerender } = render(<ListRow icon={Ghost} title="Coffee" divider />);
    expect((container.firstElementChild as HTMLElement).className).toContain(DIVIDER_CLASS);
    rerender(<ListRow icon={Ghost} title="Coffee" />);
    expect((container.firstElementChild as HTMLElement).className).not.toContain(DIVIDER_CLASS);
  });

  it("hides the icon from assistive technology", () => {
    const { container } = render(<ListRow icon={Ghost} title="Coffee" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("calls the handler once when Enter is pressed on a button row", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ListRow icon={Ghost} title="Coffee" onClick={onClick} />);
    screen.getByRole("button", { name: "Coffee" }).focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("calls the handler once when Space is pressed on a button row", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ListRow icon={Ghost} title="Coffee" onClick={onClick} />);
    screen.getByRole("button", { name: "Coffee" }).focus();
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("calls the handler once when Enter is pressed on a link row", async () => {
    const onClick = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const user = userEvent.setup();
    render(<ListRow icon={Ghost} title="Coffee" href="/x" onClick={onClick} />);
    screen.getByRole("link", { name: "Coffee" }).focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call the handler of a disabled link row", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ListRow icon={Ghost} title="Coffee" href="/x" onClick={onClick} disabled />);
    await user.click(screen.getByRole("link", { name: "Coffee" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
