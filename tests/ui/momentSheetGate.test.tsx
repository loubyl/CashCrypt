// Moments wait for an open or closing bottom sheet before they start (house-scene task 11.1 review).
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MomentHost } from "@/components/moments/MomentHost";
import type { MomentHostLive } from "@/components/moments/MomentHost";
import { playMoment } from "@/components/moments/momentLoader";
import { SHEET_SELECTOR } from "@/components/moments/sheetGate";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useActionObserver } from "@/hooks/useActionObserver";
import type { ActionObserver } from "@/hooks/useActionObserver";
import type { HouseState } from "@/lib/haunting";
import type { ActionOutcome } from "@/lib/moments/types";
import { SHEET_CLOSE_WAIT_MAX_MS, buildSceneModel } from "@/lib/scene";

vi.mock("@/components/moments/momentLoader", () => ({ playMoment: vi.fn() }));

const WAIT_MS = SHEET_CLOSE_WAIT_MAX_MS * 3;
const MONTHLY_INCOME_CENTS = 300_000;
const SETTLE_MS = 50;

const HOUSE_STATE: HouseState = {
  lightScore: 50,
  baseScore: 50,
  momentum: 0,
  decayLevel: 4,
  windowBrightness: 0.5,
  levelProgress: 0.5,
  zombies: [],
  ghosts: [],
  poltergeist: null,
};
const LIVE: MomentHostLive = {
  model: buildSceneModel({ houseState: HOUSE_STATE, monthlyIncomeCents: MONTHLY_INCOME_CENTS, graveyard: [], bound: false }),
  liveKey: {},
  subscriptionNames: { "sub-1": "StreamMax" },
  planActions: [],
};
const CANCEL: ActionOutcome = {
  kind: "cancel",
  subscriptionId: "sub-1",
  changed: true,
  monthlySavedCents: 2299,
  completedActionId: null,
};

function sheetCount(): number {
  return document.body.querySelectorAll(SHEET_SELECTOR).length;
}

type Harness = { observer: () => ActionObserver; setOpen: (open: boolean) => void };

/** The real MomentHost and BottomSheet; `playMoment` is the only fake. */
function renderHostWithSheet(initiallyOpen: boolean): Harness {
  let observer: ActionObserver | null = null;
  function Observed(): ReactNode {
    observer = useActionObserver();
    return null;
  }
  const tree = (open: boolean): ReactNode => (
    <MomentHost live={LIVE}>
      {() => (
        <>
          <div data-part="scene" />
          <Observed />
          <BottomSheet open={open} onClose={() => undefined} title="Cancel subscription">
            <p>Body</p>
          </BottomSheet>
        </>
      )}
    </MomentHost>
  );
  const result = render(tree(initiallyOpen));
  return {
    observer: () => {
      if (!observer) throw new Error("The observer is not available.");
      return observer;
    },
    setOpen: (open) => result.rerender(tree(open)),
  };
}

function triggerCancel(host: Harness): void {
  act(() => {
    const ticket = host.observer().begin({ kind: "cancel", subscriptionId: "sub-1" });
    host.observer().resolve(ticket, CANCEL);
  });
}

describe("Moments and bottom sheets", () => {
  let sheetPresentAtStart: boolean[];

  beforeEach(() => {
    sheetPresentAtStart = [];
    vi.mocked(playMoment).mockReset();
    vi.mocked(playMoment).mockImplementation(() => {
      sheetPresentAtStart.push(sheetCount() > 0);
      return Promise.resolve();
    });
  });

  it("marks the layer of an open sheet and removes it after the close transition", async () => {
    const host = renderHostWithSheet(true);
    await waitFor(() => expect(sheetCount()).toBe(1));
    host.setOpen(false);
    await waitFor(() => expect(sheetCount()).toBe(0), { timeout: WAIT_MS });
  });

  it("does not start while the sheet is open or closing, and starts after it is gone", async () => {
    const host = renderHostWithSheet(true);
    await waitFor(() => expect(sheetCount()).toBe(1));

    triggerCancel(host);
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    expect(playMoment).not.toHaveBeenCalled();

    host.setOpen(false);
    expect(playMoment).not.toHaveBeenCalled();

    await waitFor(() => expect(playMoment).toHaveBeenCalledTimes(1), { timeout: WAIT_MS });
    expect(sheetPresentAtStart).toEqual([false]);
  });

  it("starts at once when no sheet is open", async () => {
    const host = renderHostWithSheet(false);
    triggerCancel(host);
    await waitFor(() => expect(playMoment).toHaveBeenCalledTimes(1));
    expect(sheetPresentAtStart).toEqual([false]);
  });

  it("starts anyway after the wait cap when a sheet never closes", async () => {
    const host = renderHostWithSheet(true);
    await waitFor(() => expect(sheetCount()).toBe(1));
    triggerCancel(host);
    await new Promise((resolve) => setTimeout(resolve, SHEET_CLOSE_WAIT_MAX_MS / 2));
    expect(playMoment).not.toHaveBeenCalled();
    await waitFor(() => expect(playMoment).toHaveBeenCalledTimes(1), { timeout: WAIT_MS });
    expect(sheetPresentAtStart).toEqual([true]);
  });

  it("never starts a Moment that the user skips while it waits", async () => {
    const host = renderHostWithSheet(true);
    await waitFor(() => expect(sheetCount()).toBe(1));
    triggerCancel(host);
    fireEvent.pointerDown(document.body);
    host.setOpen(false);
    await waitFor(() => expect(sheetCount()).toBe(0), { timeout: WAIT_MS });
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    expect(playMoment).not.toHaveBeenCalled();
  });
});
