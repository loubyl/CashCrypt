import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Input } from "@/components/ui/Input";
import { setReducedMotion } from "./helpers/motion";

describe("Input", () => {
  it("uses the label as the accessible name", () => {
    render(<Input label="Debt name" />);
    expect(screen.getByRole("textbox", { name: "Debt name" })).toBeInTheDocument();
  });

  it("links the error message and sets aria-invalid", () => {
    render(<Input label="Debt name" error="Too short" />);
    const input = screen.getByRole("textbox", { name: "Debt name" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Too short");
  });

  it("links the hint through aria-describedby", () => {
    render(<Input label="Debt name" hint="Use the statement name" />);
    const input = screen.getByRole("textbox", { name: "Debt name" });
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("Use the statement name");
  });

  it("links both the error and the hint", () => {
    render(<Input label="Debt name" error="Too short" hint="A hint" />);
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription("Too short A hint");
  });

  it("sets the native disabled attribute", () => {
    render(<Input label="Debt name" disabled />);
    expect(screen.getByRole("textbox", { name: "Debt name" })).toBeDisabled();
  });

  it("forwards the ref to the input element", () => {
    let element: HTMLInputElement | null = null;
    render(<Input label="Debt name" ref={(node) => { element = node; }} />);
    expect(element).toBeInstanceOf(HTMLInputElement);
  });

  it("does not set inputmode on the text variant", () => {
    render(<Input label="Debt name" />);
    expect(screen.getByRole("textbox")).not.toHaveAttribute("inputmode");
  });

  it("shakes the field when an error is shown and motion is allowed", () => {
    const { container } = render(<Input label="Debt name" error="Too short" />);
    expect(container.querySelector("[data-reduced-motion]")).toHaveAttribute("data-reduced-motion", "false");
  });

  it("shows the error without a shake when motion is reduced", () => {
    setReducedMotion(true);
    const { container } = render(<Input label="Debt name" error="Too short" />);
    expect(container.querySelector("[data-reduced-motion]")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByText("Too short")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Input money variant", () => {
  it("sets inputmode decimal", () => {
    render(<Input variant="money" label="Amount" />);
    expect(screen.getByRole("textbox", { name: "Amount" })).toHaveAttribute("inputmode", "decimal");
  });

  it("rejects letters", async () => {
    const user = userEvent.setup();
    render(<Input variant="money" label="Amount" />);
    const input = screen.getByRole("textbox", { name: "Amount" });
    await user.type(input, "1a2b");
    expect(input).toHaveValue("12");
  });

  it("ignores a second decimal separator when the value is committed", async () => {
    const user = userEvent.setup();
    render(<Input variant="money" label="Amount" />);
    const input = screen.getByRole("textbox", { name: "Amount" });
    await user.type(input, "1.2.3");
    await user.tab();
    expect(input).toHaveValue("1.23");
  });

  it("caps the fraction at 2 digits when the value is committed", async () => {
    const user = userEvent.setup();
    render(<Input variant="money" label="Amount" />);
    const input = screen.getByRole("textbox", { name: "Amount" });
    await user.type(input, "1.2345");
    await user.tab();
    expect(input).toHaveValue("1.23");
  });

  it("keeps the raw text while typing, so a comma is not converted early", async () => {
    const user = userEvent.setup();
    render(<Input variant="money" label="Amount" />);
    const input = screen.getByRole("textbox", { name: "Amount" });
    await user.type(input, "1,");
    expect(input).toHaveValue("1,");
    await user.type(input, "000");
    expect(input).toHaveValue("1,000");
  });

  it("commits 1,000 typed key by key as 1,000.00 on blur", async () => {
    const user = userEvent.setup();
    render(<Input variant="money" label="Amount" />);
    const input = screen.getByRole("textbox", { name: "Amount" });
    await user.type(input, "1,000");
    await user.tab();
    expect(input).toHaveValue("1,000.00");
  });

  it("commits 15,49 typed key by key as 15.49 on blur", async () => {
    const user = userEvent.setup();
    render(<Input variant="money" label="Amount" />);
    const input = screen.getByRole("textbox", { name: "Amount" });
    await user.type(input, "15,49");
    await user.tab();
    expect(input).toHaveValue("15.49");
  });

  it("gives the parent the committed value through onChange and onBlur", async () => {
    const user = userEvent.setup();
    const changes: string[] = [];
    let blurred = "";
    render(
      <Input
        variant="money"
        label="Amount"
        onChange={(event) => changes.push(event.target.value)}
        onBlur={(event) => {
          blurred = event.target.value;
        }}
      />,
    );
    await user.type(screen.getByRole("textbox", { name: "Amount" }), "1,000");
    await user.tab();
    expect(changes.at(-1)).toBe("1,000.00");
    expect(blurred).toBe("1,000.00");
  });

  it("centers the currency prefix and the number together as one group", async () => {
    const user = userEvent.setup();
    const { container } = render(<Input variant="money" label="Amount" />);
    const input = screen.getByRole("textbox", { name: "Amount" });
    const group = container.querySelector("[data-money-prefix-group]") as HTMLElement;
    expect(group).toHaveAttribute("aria-hidden", "true");
    expect(group).toHaveClass("absolute", "inset-0", "flex", "justify-center");
    const [prefix, ghost] = Array.from(group.children) as HTMLElement[];
    expect(prefix).toHaveTextContent("$");
    expect(prefix.className).not.toMatch(/\b(left|right)-/);
    expect(ghost).toHaveTextContent("0.00");
    await user.type(input, "15,4");
    expect(ghost).toHaveTextContent("15,4");
    await user.tab();
    expect(ghost).toHaveTextContent("15.40");
  });

  it("formats 5 to 5.00 on blur", async () => {
    const user = userEvent.setup();
    render(<Input variant="money" label="Amount" />);
    const input = screen.getByRole("textbox", { name: "Amount" });
    await user.type(input, "5");
    await user.tab();
    expect(input).toHaveValue("5.00");
  });

  it("leaves an empty value empty on blur", async () => {
    const user = userEvent.setup();
    render(<Input variant="money" label="Amount" />);
    const input = screen.getByRole("textbox", { name: "Amount" });
    await user.click(input);
    await user.tab();
    expect(input).toHaveValue("");
  });

  it("calls onChange with the formatted value on blur", async () => {
    const user = userEvent.setup();
    const values: string[] = [];
    render(<Input variant="money" label="Amount" onChange={(event) => values.push(event.target.value)} />);
    await user.type(screen.getByRole("textbox", { name: "Amount" }), "7");
    await user.tab();
    expect(values.at(-1)).toBe("7.00");
  });
});
