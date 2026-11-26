// MomentHost request triggers with a fake `play`
// (house-scene Requirements 12.1, 12.2, 12.3, 16.6, 24.7).
import { act, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MomentHost } from "@/components/moments/MomentHost";
import type { MomentHostLive, MomentHostView } from "@/components/moments/MomentHost";
import { playMoment } from "@/components/moments/momentLoader";
import { useActionObserver } from "@/hooks/useActionObserver";
import type { ActionObserver, ObservedAction } from "@/hooks/useActionObserver";
import type { HouseState } from "@/lib/haunting";
import type { DecayLevel } from "@/lib/haunting/config";
import type { ActionOutcome, MomentRequest, PlanActionView } from "@/lib/moments/types";
import { MOMENT_GAP_MS, buildSceneModel } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";

vi.mock("@/components/moments/momentLoader", () => ({ playMoment: vi.fn() }));

const MONTHLY_INCOME_CENTS = 300_000;
const WAIT_MS = 2000;
const QUIET_MS = MOMENT_GAP_MS * 3;
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const POLTERGEIST_TOTAL_CENTS = 9000;
const POLTERGEIST_COUNT = 8;
const SMALL_EXPENSES_KIND = "reduce_small_expenses";
const realMatchMedia = window.matchMedia;

type Played = { request: MomentRequest; finish: () => void };
const played: Played[] = [];

function installFakePlay(): void {
  played.length = 0;
  vi.mocked(playMoment).mockReset();
  vi.mocked(playMoment).mockImplementation(
    (request) => new Promise<void>((resolve) => void played.push({ request, finish: () => resolve() })),
  );
}

function stubReducedPreference(reduced: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduced && query === REDUCED_QUERY,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    }),
  });
}

type LiveOptions = { level: DecayLevel; poltergeist?: boolean; planActions?: PlanActionView[] };

function liveWith({ level, poltergeist = false, planActions = [] }: LiveOptions): MomentHostLive {
  const houseState: HouseState = {
    lightScore: 50,
    baseScore: 50,
    momentum: 0,
    decayLevel: level,
    windowBrightness: 0.5,
    levelProgress: 0.5,
    zombies: [],
    ghosts: [],
    poltergeist: poltergeist
      ? { totalAmount: POLTERGEIST_TOTAL_CENTS, transactionCount: POLTERGEIST_COUNT, byCategory: {} }
      : null,
  };
  const model: SceneModel = buildSceneModel({
    houseState,
    monthlyIncomeCents: MONTHLY_INCOME_CENTS,
    graveyard: [],
    bound: false,
  });
  return {
    model,
    liveKey: {},
    subscriptionNames: { "sub-1": "StreamMax", "sub-2": "ToonBox" },
    planActions,
  };
}

type Harness = { observer: () => ActionObserver; update: (live: MomentHostLive) => void; view: () => MomentHostView };

function renderHost(initial: MomentHostLive): Harness {
  let observer: ActionObserver | null = null;
  let view: MomentHostView | null = null;
  function Observed(): ReactNode {
    observer = useActionObserver();
    return null;
  }
  const tree = (live: MomentHostLive): ReactNode => (
    <MomentHost live={live}>
      {(next) => {
        view = next;
        return (
          <>
            <div data-part="scene" />
            <Observed />
          </>
        );
      }}
    </MomentHost>
  );
  const result = render(tree(initial));
  return {
    observer: () => {
      if (!observer) throw new Error("The observer is not available.");
      return observer;
    },
    update: (live) => result.rerender(tree(live)),
    view: () => {
      if (!view) throw new Error("The host has not rendered yet.");
      return view;
    },
  };
}

/** Runs begin and resolve for one action, as the hooks do. */
async function runAction(host: Harness, action: ObservedAction, outcome: ActionOutcome): Promise<void> {
  await act(async () => {
    const ticket = host.observer().begin(action);
    host.observer().resolve(ticket, outcome);
  });
}

/** Finishes each Moment in turn until no more are requested, then returns the played kinds. */
async function drainKinds(): Promise<string[]> {
  const kinds: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    try {
      await waitFor(() => expect(played.length).toBeGreaterThan(index), { timeout: QUIET_MS });
    } catch {
      break;
    }
    kinds.push(played[index]?.request.kind ?? "");
    await act(async () => played[index]?.finish());
  }
  return kinds;
}

async function expectNoRequest(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, QUIET_MS));
  });
  expect(played).toHaveLength(0);
}

const cancel = (subscriptionId: string, changed: boolean, completedActionId: string | null = null): ActionOutcome => ({
  kind: "cancel",
  subscriptionId,
  changed,
  monthlySavedCents: changed ? 2299 : 0,
  completedActionId,
});
const payment = (extraPrincipalCents: number): ActionOutcome => ({
  kind: "payment",
  extraPrincipalCents,
  completedActionId: null,
  origin: null,
});
const toggle = (actionId: string, next: boolean): ActionOutcome => ({ kind: "planToggle", actionId, next, lightDelta: 0 });
const cancelAction = (subscriptionId: string): ObservedAction => ({ kind: "cancel", subscriptionId });
const toggleAction = (actionId: string, next: boolean): ObservedAction => ({ kind: "planToggle", actionId, next });

const PLAN_TWO_DONE: PlanActionView[] = [
  { id: "a1", kind: "cancel_subscription", done: true },
  { id: "a2", kind: "extra_payment", done: true },
  { id: "a3", kind: SMALL_EXPENSES_KIND, done: false },
];

beforeEach(() => {
  installFakePlay();
  stubReducedPreference(false);
});

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: realMatchMedia });
});

describe("MomentHost request triggers", () => {
  it("requests a cancel Moment when a subscription is canceled", async () => {
    const host = renderHost(liveWith({ level: 4 }));
    await runAction(host, cancelAction("sub-1"), cancel("sub-1", true));

    const kinds = await drainKinds();

    expect(kinds).toEqual(["cancel"]);
    expect(played[0]?.request).toMatchObject({ kind: "cancel", subscriptionId: "sub-1", name: "StreamMax" });
  });

  it("requests a payment Moment when the payment includes extra principal", async () => {
    const host = renderHost(liveWith({ level: 4 }));
    await runAction(host, { kind: "payment", debtId: "debt-1" }, payment(5000));

    expect(await drainKinds()).toEqual(["payment"]);
  });

  it("requests a sigil Moment when the small-expenses action is ticked with a Poltergeist present", async () => {
    const host = renderHost(liveWith({ level: 4, poltergeist: true, planActions: PLAN_TWO_DONE.map((a) => ({ ...a, done: false })) }));
    await runAction(host, toggleAction("a3", true), toggle("a3", true));

    expect(await drainKinds()).toEqual(["sigil"]);
  });

  it("requests an exorcismComplete Moment when the third plan action is completed", async () => {
    const host = renderHost(liveWith({ level: 4, planActions: PLAN_TWO_DONE }));
    await runAction(host, toggleAction("a3", true), toggle("a3", true));

    expect(await drainKinds()).toEqual(["exorcismComplete"]);
  });

  it("requests the cancel Moment first and then exorcismComplete when a cancel completes the third action", async () => {
    const host = renderHost(liveWith({ level: 4, planActions: PLAN_TWO_DONE }));
    await runAction(host, cancelAction("sub-1"), cancel("sub-1", true, "a3"));

    expect(await drainKinds()).toEqual(["cancel", "exorcismComplete"]);
  });

  it("requests a level Moment when the level changes after an action", async () => {
    const host = renderHost(liveWith({ level: 4 }));
    let ticket: { id: number } | undefined;
    act(() => {
      ticket = host.observer().begin(cancelAction("sub-1"));
    });
    act(() => host.update(liveWith({ level: 3 })));
    await act(async () => {
      host.observer().resolve(ticket as { id: number }, cancel("sub-1", true));
    });

    expect(await drainKinds()).toEqual(["cancel", "level"]);
    expect(played[1]?.request).toEqual({ kind: "level", from: 4, to: 3 });
  });

  it("requests nothing for a cancel that changed nothing", async () => {
    const host = renderHost(liveWith({ level: 4 }));
    await runAction(host, cancelAction("sub-1"), cancel("sub-1", false));
    await expectNoRequest();
  });

  it("requests nothing for a payment at or below the minimum", async () => {
    const host = renderHost(liveWith({ level: 4 }));
    await runAction(host, { kind: "payment", debtId: "debt-1" }, payment(0));
    await expectNoRequest();
  });

  it("requests nothing when a plan action is unticked", async () => {
    const host = renderHost(liveWith({ level: 4, poltergeist: true, planActions: PLAN_TWO_DONE }));
    await runAction(host, toggleAction("a3", false), toggle("a3", false));
    await expectNoRequest();
  });

  it("requests nothing when the small-expenses action is ticked without a Poltergeist", async () => {
    const host = renderHost(liveWith({ level: 4, planActions: PLAN_TWO_DONE.map((a) => ({ ...a, done: false })) }));
    await runAction(host, toggleAction("a3", true), toggle("a3", true));
    await expectNoRequest();
  });

  it("requests nothing when a third completion is not the third", async () => {
    const plan = PLAN_TWO_DONE.map((a) => ({ ...a, done: false }));
    const host = renderHost(liveWith({ level: 4, planActions: plan }));
    await runAction(host, toggleAction("a1", true), toggle("a1", true));
    await expectNoRequest();
  });

  it("requests nothing on page load", async () => {
    renderHost(liveWith({ level: 4, poltergeist: true, planActions: PLAN_TWO_DONE }));
    await expectNoRequest();
  });

  it.each([
    ["a demo load", 2 as DecayLevel],
    ["a reset", 5 as DecayLevel],
    ["a Skip_Week", 3 as DecayLevel],
  ])("requests nothing when %s changes the level without a user action", async (_name, level) => {
    const host = renderHost(liveWith({ level: 4 }));
    act(() => host.update(liveWith({ level })));
    act(() => host.update(liveWith({ level: 4 })));
    await expectNoRequest();
    expect(host.view().held).toBe(false);
  });

  it("does not repeat the level Moment when two actions settle on the same new level", async () => {
    const host = renderHost(liveWith({ level: 4 }));
    let first: { id: number } | undefined;
    let second: { id: number } | undefined;
    act(() => {
      first = host.observer().begin(cancelAction("sub-1"));
      second = host.observer().begin(cancelAction("sub-2"));
    });
    act(() => host.update(liveWith({ level: 3 })));
    await act(async () => {
      host.observer().resolve(first as { id: number }, cancel("sub-1", false));
      host.observer().resolve(second as { id: number }, cancel("sub-2", false));
    });

    const kinds = await drainKinds();

    expect(kinds).toEqual(["level"]);
    expect(played).toHaveLength(1);
  });

  it("does not freeze the Scene model under reduced motion", async () => {
    stubReducedPreference(true);
    const host = renderHost(liveWith({ level: 4 }));
    let ticket: { id: number } | undefined;
    act(() => {
      ticket = host.observer().begin(cancelAction("sub-1"));
    });
    expect(host.view().held).toBe(false);

    act(() => host.update(liveWith({ level: 3 })));
    expect(host.view().held).toBe(false);
    expect(host.view().model.level).toBe(3);

    await act(async () => {
      host.observer().resolve(ticket as { id: number }, cancel("sub-1", true));
    });
    await waitFor(() => expect(played.length).toBeGreaterThan(0), { timeout: WAIT_MS });
    expect(host.view().held).toBe(false);
    expect(host.view().model.level).toBe(3);
  });
});
