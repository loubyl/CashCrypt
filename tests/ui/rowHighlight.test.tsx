import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RowHighlightProvider,
  useRequestHighlight,
  useRowHighlight,
} from "@/components/feedback/RowHighlightProvider";
import {
  HIGHLIGHT_PENDING_TTL_MS,
  HIGHLIGHT_WAIT_MS,
  ROW_HIGHLIGHT_MS,
} from "@/components/ui/motionTokens";
import { getRowDomId, HIGHLIGHT_TAG_TEXT } from "@/lib/utils/destinations";

const HEADING_ID = "debts-heading";
const ROWS = [
  { id: "a", label: "Visa" },
  { id: "b", label: "Car loan" },
];

type Request = ReturnType<typeof useRequestHighlight>;
const requestHolder: { current: Request } = { current: () => undefined };
const request: Request = (target) => requestHolder.current(target);

function Probe({ rows }: { rows: typeof ROWS | null }) {
  const requestHighlight = useRequestHighlight();
  useEffect(() => {
    requestHolder.current = requestHighlight;
  }, [requestHighlight]);
  const { highlightedId, tag } = useRowHighlight({
    list: "debts",
    rows,
    listLabel: "Your debts",
    headingId: HEADING_ID,
  });
  return (
    <div>
      <h2 id={HEADING_ID} tabIndex={-1}>
        Debts
      </h2>
      {(rows ?? []).map((row) => (
        <div key={row.id} id={getRowDomId("debts", row.id)} tabIndex={-1} data-testid={row.id}>
          {row.label}
          {highlightedId === row.id ? <span>{tag ? HIGHLIGHT_TAG_TEXT[tag] : null}</span> : null}
        </div>
      ))}
    </div>
  );
}

function renderProbe() {
  return render(
    <RowHighlightProvider>
      <Probe rows={ROWS} />
    </RowHighlightProvider>,
  );
}

const scrollIntoView = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("row highlight", () => {
  it("highlights a found row, moves focus and announces it", () => {
    renderProbe();
    act(() => request({ list: "debts", rowId: "b", tag: "new", focus: true }));
    expect(screen.getByText("New")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByTestId("b"));
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(screen.getByRole("status").textContent).toBe("Car loan highlighted in Your debts");
  });

  it("highlights without moving focus when focus is false", () => {
    renderProbe();
    act(() => request({ list: "debts", rowId: "a", tag: "updated", focus: false }));
    expect(screen.getByText("Updated")).toBeTruthy();
    expect(document.activeElement).not.toBe(screen.getByTestId("a"));
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("Visa highlighted in Your debts");
  });

  it("clears the highlight after 4000 ms", () => {
    renderProbe();
    act(() => request({ list: "debts", rowId: "a", tag: "new", focus: false }));
    expect(screen.getByText("New")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(ROW_HIGHLIGHT_MS - 1);
    });
    expect(screen.queryByText("New")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("New")).toBeNull();
  });

  it("focuses the heading and announces when the row is missing", () => {
    renderProbe();
    act(() => request({ list: "debts", rowId: "gone", tag: "new", focus: true }));
    expect(screen.getByRole("status").textContent).toBe("");
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_WAIT_MS);
    });
    expect(document.activeElement).toBe(document.getElementById(HEADING_ID));
    expect(screen.getByRole("status").textContent).toBe("That item is no longer here");
  });

  it("ignores a pending request older than the TTL", () => {
    const view = render(
      <RowHighlightProvider>
        <Probe rows={null} />
      </RowHighlightProvider>,
    );
    act(() => request({ list: "debts", rowId: "a", tag: "new", focus: true }));
    act(() => {
      vi.advanceTimersByTime(HIGHLIGHT_PENDING_TTL_MS + 1);
    });
    view.rerender(
      <RowHighlightProvider>
        <Probe rows={ROWS} />
      </RowHighlightProvider>,
    );
    expect(screen.queryByText("New")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("highlights nothing in a fresh provider", () => {
    renderProbe();
    expect(screen.queryByText("New")).toBeNull();
    expect(screen.queryByText("Updated")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
