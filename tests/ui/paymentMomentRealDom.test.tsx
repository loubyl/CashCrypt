// The payment Moment against the real rendered DOM (no GSAP mock):
// its selectors must find what WindowsLayer draws, and the flame origin is the submit control
// (house-scene Requirements 12.2, 14.1, 14.3, 14.4).
import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WindowsLayer } from "@/components/house/WindowsLayer";
import { makeFilterIds } from "@/components/house/houseGeometry";
import { planLitWindows } from "@/components/moments/CandleOrbMoment";
import { MomentHost } from "@/components/moments/MomentHost";
import type { MomentHostLive } from "@/components/moments/MomentHost";
import { playMoment } from "@/components/moments/momentLoader";
import { useActionObserver } from "@/hooks/useActionObserver";
import type { ActionObserver } from "@/hooks/useActionObserver";
import type { HouseState } from "@/lib/haunting";
import type { DecayLevel } from "@/lib/haunting/config";
import type { MomentRequest } from "@/lib/moments/types";
import { buildSceneModel } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";

vi.mock("@/components/moments/momentLoader", () => ({ playMoment: vi.fn() }));

const MONTHLY_INCOME_CENTS = 300_000;
const LEVEL: DecayLevel = 3;
const PAYMENT_EXTRA_CENTS = 30_000;
const WAIT_MS = 2000;

function modelAt(level: DecayLevel): SceneModel {
  const houseState: HouseState = {
    lightScore: 50,
    baseScore: 50,
    momentum: 0,
    decayLevel: level,
    windowBrightness: 0.5,
    levelProgress: 0.5,
    zombies: [],
    ghosts: [],
    poltergeist: null,
  };
  return buildSceneModel({ houseState, monthlyIncomeCents: MONTHLY_INCOME_CENTS, graveyard: [], bound: false });
}

describe("payment Moment selectors", () => {
  it("find the light and glow groups that WindowsLayer renders for every lit window", () => {
    const model = modelAt(LEVEL);
    const { container } = render(
      <svg>
        <WindowsLayer model={model} filterIds={makeFilterIds("test")} />
      </svg>,
    );

    const planned = planLitWindows(container, model);
    const litCount = model.windows.filter((window) => window.state === "lit").length;

    expect(litCount).toBeGreaterThan(0);
    expect(planned).toHaveLength(litCount);
    for (const entry of planned) {
      expect(entry.light?.getAttribute("data-part")).toBe("light");
      expect(entry.glow?.getAttribute("data-part")).toBe("glow");
      expect(entry.from).toBeCloseTo(model.windows.find((w) => w.state === "lit")?.opacity ?? Number.NaN, 5);
    }
  });
});

describe("payment Moment origin", () => {
  const played: MomentRequest[] = [];

  beforeEach(() => {
    played.length = 0;
    vi.mocked(playMoment).mockReset();
    vi.mocked(playMoment).mockImplementation((request) => {
      played.push(request);
      return Promise.resolve();
    });
  });

  afterEach(() => vi.restoreAllMocks());

  function renderForm(): { submit: HTMLButtonElement; input: HTMLInputElement; observer: () => ActionObserver } {
    let observer: ActionObserver | null = null;
    const live: MomentHostLive = { model: modelAt(LEVEL), liveKey: {}, subscriptionNames: {}, planActions: [] };
    function Observed(): ReactNode {
      observer = useActionObserver();
      return null;
    }
    render(
      <MomentHost live={live}>
        {() => (
          <>
            <div data-part="scene" />
            <Observed />
            <form onSubmit={(event) => event.preventDefault()}>
              <input aria-label="Amount" />
              <button type="submit">Save payment</button>
            </form>
          </>
        )}
      </MomentHost>,
    );
    const submit = document.querySelector<HTMLButtonElement>('button[type="submit"]');
    const input = document.querySelector<HTMLInputElement>("input");
    if (!submit || !input) throw new Error("The form did not render.");
    return {
      submit,
      input,
      observer: () => {
        if (!observer) throw new Error("No observer.");
        return observer;
      },
    };
  }

  const rectOf = (left: number, top: number): DOMRect =>
    ({ left, top, width: 200, height: 52, right: left + 200, bottom: top + 52, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

  it("is the submit button, even when the focused element is the amount field", async () => {
    const { submit, input, observer } = renderForm();
    vi.spyOn(submit, "getBoundingClientRect").mockReturnValue(rectOf(252, 474));
    vi.spyOn(input, "getBoundingClientRect").mockReturnValue(rectOf(40, 120));

    input.focus();
    await act(async () => {
      // Enter in the field: the form is submitted with the button as submitter.
      submit.closest("form")?.requestSubmit(submit);
      const ticket = observer().begin({ kind: "payment", debtId: "debt-1" });
      observer().resolve(ticket, {
        kind: "payment",
        extraPrincipalCents: PAYMENT_EXTRA_CENTS,
        completedActionId: null,
        origin: null,
      });
    });

    await vi.waitFor(() => expect(played.length).toBeGreaterThan(0), { timeout: WAIT_MS });
    expect(document.activeElement).toBe(input);
    expect(played[0]).toMatchObject({ kind: "payment", origin: { left: 252, top: 474, width: 200, height: 52 } });
  });
});
