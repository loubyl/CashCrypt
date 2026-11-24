// Action observer wiring (hooks) and MomentHost with a fake `play`
// (house-scene Requirements 12.1, 12.3, 12.9, 12.17, 12.19, 24.7).
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MomentHost } from "@/components/moments/MomentHost";
import type { MomentHostLive } from "@/components/moments/MomentHost";
import { playMoment } from "@/components/moments/momentLoader";
import type { MomentTarget } from "@/components/moments/momentLoader";
import { ActionObserverContext, useActionObserver } from "@/hooks/useActionObserver";
import type { ActionObserver, ActionTicket } from "@/hooks/useActionObserver";
import { useCryptActions } from "@/hooks/useCryptActions";
import type { CryptActions } from "@/hooks/useCryptActions";
import { useExorcismPlan } from "@/hooks/useExorcismPlan";
import type { ExorcismPlanState } from "@/hooks/useExorcismPlan";
import type { HouseState } from "@/lib/haunting";
import type { DecayLevel } from "@/lib/haunting/config";
import type { ActionOutcome, MomentRequest } from "@/lib/moments/types";
import { MOMENT_GAP_MS } from "@/lib/scene";
import { buildSceneModel } from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";
import type { DebtRow, SubscriptionRow } from "@/types/finance";
import { renderWithCrypt } from "./helpers/crypt";

vi.mock("@/components/moments/momentLoader", () => ({ playMoment: vi.fn() }));

const NOW = "2025-06-15";
const MONTHLY_INCOME_CENTS = 300_000;
const WAIT_MS = 2000;
const GAP_WAIT_MS = MOMENT_GAP_MS * 3;
const SUBSCRIPTION_ID = "sub-1";
const DEBT_ID = "debt-1";
const DEBT: DebtRow = {
  id: DEBT_ID,
  name: "Test loan",
  balanceCents: 1_000_000,
  apr: 0.2,
  minimumPaymentCents: 20_000,
};
const SUBSCRIPTION: SubscriptionRow = {
  id: SUBSCRIPTION_ID,
  name: "StreamMax",
  amountCents: 2299,
  cadence: "monthly",
  usage: "never",
  active: true,
};
const SRC_ROOT = join(process.cwd(), "src");
const SCREENS = ["SubscriptionsScreen.tsx", "ExorcismScreen.tsx"];

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

type HookProbe = { actions: CryptActions | null; plan: ExorcismPlanState | null };

function createHookProbe(): { probe: HookProbe; Component: () => ReactNode } {
  const probe: HookProbe = { actions: null, plan: null };
  function Component(): ReactNode {
    probe.actions = useCryptActions();
    probe.plan = useExorcismPlan();
    return null;
  }
  return { probe, Component };
}

function createRecordingObserver(calls: string[], onBegin?: () => void): ActionObserver {
  let next = 0;
  return {
    begin: (action) => {
      onBegin?.();
      calls.push(`begin:${action.kind}`);
      next += 1;
      return { id: next };
    },
    resolve: (_ticket: ActionTicket, outcome: ActionOutcome) => void calls.push(`resolve:${outcome.kind}`),
    fail: () => void calls.push("fail"),
  };
}

function requireActions(probe: HookProbe): CryptActions {
  if (!probe.actions) throw new Error("The probe has not rendered yet.");
  return probe.actions;
}

describe("action observer hooks", () => {
  it("calls begin before the cancel is saved and resolve after it", async () => {
    const calls: string[] = [];
    const { probe, Component } = createHookProbe();
    let activeAtBegin: boolean | undefined;
    const ctx = await renderWithCrypt(<Component />, {
      mode: "real",
      seed: { subscriptions: [SUBSCRIPTION] },
      now: NOW,
    });
    const observer = createRecordingObserver(calls, () => {
      void ctx.realDb.subscriptions.get(SUBSCRIPTION_ID).then((row) => {
        activeAtBegin = row?.active;
      });
    });
    ctx.rerenderWithCrypt(
      <ActionObserverContext.Provider value={observer}>
        <Component />
      </ActionObserverContext.Provider>,
    );
    await waitFor(() => expect(probe.plan?.status).toBe("ready"));

    let result: Awaited<ReturnType<CryptActions["cancelSubscription"]>> | undefined;
    await act(async () => {
      result = await requireActions(probe).cancelSubscription(SUBSCRIPTION_ID);
    });

    expect(result?.ok).toBe(true);
    expect(calls).toEqual(["begin:cancel", "resolve:cancel"]);
    expect(activeAtBegin).toBe(true);
    expect((await ctx.realDb.subscriptions.get(SUBSCRIPTION_ID))?.active).toBe(false);
  });

  it("calls begin and then resolve with the extra principal of a payment", async () => {
    const calls: string[] = [];
    const resolved: ActionOutcome[] = [];
    const observer = createRecordingObserver(calls);
    const recording: ActionObserver = {
      ...observer,
      resolve: (ticket, outcome) => {
        resolved.push(outcome);
        observer.resolve(ticket, outcome);
      },
    };
    const { probe, Component } = createHookProbe();
    await renderWithCrypt(
      <ActionObserverContext.Provider value={recording}>
        <Component />
      </ActionObserverContext.Provider>,
      { mode: "real", seed: { debts: [DEBT] }, now: NOW },
    );
    await waitFor(() => expect(probe.plan?.status).toBe("ready"));

    await act(async () => {
      await requireActions(probe).logPayment(DEBT_ID, DEBT.minimumPaymentCents + 5000);
    });

    expect(calls).toEqual(["begin:payment", "resolve:payment"]);
    const outcome = resolved[0];
    expect(outcome?.kind === "payment" && outcome.extraPrincipalCents).toBe(5000);
  });

  it("calls begin and then fail when the action fails", async () => {
    const calls: string[] = [];
    const { probe, Component } = createHookProbe();
    await renderWithCrypt(
      <ActionObserverContext.Provider value={createRecordingObserver(calls)}>
        <Component />
      </ActionObserverContext.Provider>,
      { mode: "real", seed: { debts: [DEBT] }, now: NOW },
    );
    await waitFor(() => expect(probe.plan?.status).toBe("ready"));

    let result: Awaited<ReturnType<CryptActions["logPayment"]>> | undefined;
    await act(async () => {
      result = await requireActions(probe).logPayment("missing-debt", 1000);
    });

    expect(result?.ok).toBe(false);
    expect(calls).toEqual(["begin:payment", "fail"]);
  });

  it("observes plan toggles from the exorcism plan hook", async () => {
    const calls: string[] = [];
    const { probe, Component } = createHookProbe();
    await renderWithCrypt(
      <ActionObserverContext.Provider value={createRecordingObserver(calls)}>
        <Component />
      </ActionObserverContext.Provider>,
      { mode: "real", seed: { debts: [DEBT], subscriptions: [SUBSCRIPTION] }, now: NOW },
    );
    await waitFor(() => expect(probe.plan?.status).toBe("ready"));
    const first = probe.plan?.plan?.actions[0];
    if (!first) throw new Error("Expected a plan action.");

    await act(async () => {
      await probe.plan?.toggleAction(first.id, true);
    });

    expect(calls).toEqual(["begin:planToggle", "resolve:planToggle"]);
  });

  it("behaves the same with no provider", async () => {
    const { probe, Component } = createHookProbe();
    const ctx = await renderWithCrypt(<Component />, {
      mode: "real",
      seed: { subscriptions: [SUBSCRIPTION], debts: [DEBT] },
      now: NOW,
    });
    await waitFor(() => expect(probe.plan?.status).toBe("ready"));

    let cancelled: Awaited<ReturnType<CryptActions["cancelSubscription"]>> | undefined;
    await act(async () => {
      cancelled = await requireActions(probe).cancelSubscription(SUBSCRIPTION_ID);
    });
    let paid: Awaited<ReturnType<CryptActions["logPayment"]>> | undefined;
    await act(async () => {
      paid = await requireActions(probe).logPayment(DEBT_ID, DEBT.minimumPaymentCents + 5000);
    });

    expect(cancelled?.ok).toBe(true);
    expect(paid?.ok).toBe(true);
    expect((await ctx.realDb.subscriptions.get(SUBSCRIPTION_ID))?.active).toBe(false);
  });

  it("returns no observer outside the Dashboard host", () => {
    let seen: ActionObserver | null | undefined;
    function Reader(): ReactNode {
      seen = useActionObserver();
      return null;
    }
    render(<Reader />);
    expect(seen).toBeNull();
  });

  it("provides the observer only from MomentHost, which neither the subscriptions nor the exorcism screen uses", () => {
    const providers: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && readFileSync(path, "utf8").includes("ActionObserverContext.Provider")) {
          providers.push(name);
        }
      }
    };
    walk(SRC_ROOT);
    expect(providers).toEqual(["MomentHost.tsx"]);

    for (const screen of SCREENS) {
      const source = readFileSync(join(SRC_ROOT, "components", "screens", screen), "utf8");
      expect(source).not.toContain("MomentHost");
    }
  });
});

// ---------------------------------------------------------------------------
// MomentHost
// ---------------------------------------------------------------------------

type PlayCall = {
  request: MomentRequest;
  target: MomentTarget;
  signal: AbortSignal;
  finish: () => void;
};

const playCalls: PlayCall[] = [];
const cleanupSpy = vi.fn();

function installFakePlay(): void {
  playCalls.length = 0;
  vi.mocked(playMoment).mockReset();
  vi.mocked(playMoment).mockImplementation(
    (request, target, signal) =>
      new Promise<void>((resolve) => {
        target.registerCleanup(cleanupSpy);
        playCalls.push({ request, target, signal, finish: () => resolve() });
      }),
  );
}

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

function liveAt(level: DecayLevel): MomentHostLive {
  return {
    model: modelAt(level),
    liveKey: {},
    subscriptionNames: { "sub-1": "StreamMax", "sub-2": "ToonBox" },
    planActions: [],
  };
}

function cancelOutcome(subscriptionId: string): ActionOutcome {
  return { kind: "cancel", subscriptionId, changed: true, monthlySavedCents: 2299, completedActionId: null };
}

type HostHarness = {
  observer: () => ActionObserver;
  update: (live: MomentHostLive) => void;
  unmount: () => void;
};

function renderHost(initial: MomentHostLive): HostHarness {
  let observer: ActionObserver | null = null;
  function Observed(): ReactNode {
    observer = useActionObserver();
    return null;
  }
  const tree = (live: MomentHostLive): ReactNode => (
    <MomentHost live={live}>
      {(view) => (
        <>
          <div data-part="scene" data-testid="scene" data-level={view.model.level} data-held={String(view.held)} />
          <Observed />
        </>
      )}
    </MomentHost>
  );
  const result = render(tree(initial));
  return {
    observer: () => {
      if (!observer) throw new Error("The observer is not available.");
      return observer;
    },
    update: (live) => result.rerender(tree(live)),
    unmount: () => result.unmount(),
  };
}

function shownLevel(): string | null {
  return screen.getByTestId("scene").getAttribute("data-level");
}

describe("MomentHost", () => {
  beforeEach(() => {
    installFakePlay();
    cleanupSpy.mockReset();
  });

  it("draws the model from before the action until the queue is idle, then releases it", async () => {
    const host = renderHost(liveAt(4));
    let ticket: ActionTicket | undefined;
    act(() => {
      ticket = host.observer().begin({ kind: "cancel", subscriptionId: "sub-1" });
    });
    act(() => host.update(liveAt(3)));
    expect(shownLevel()).toBe("4");
    expect(screen.getByTestId("scene").getAttribute("data-held")).toBe("true");

    await act(async () => {
      host.observer().resolve(ticket as ActionTicket, cancelOutcome("sub-1"));
    });
    await waitFor(() => expect(playCalls).toHaveLength(1));
    expect(playCalls[0]?.request.kind).toBe("cancel");
    expect(shownLevel()).toBe("4");

    await act(async () => playCalls[0]?.finish());
    await waitFor(() => expect(playCalls).toHaveLength(2), { timeout: WAIT_MS });
    expect(playCalls[1]?.request).toEqual({ kind: "level", from: 4, to: 3 });
    expect(shownLevel()).toBe("4");
    expect(cleanupSpy).not.toHaveBeenCalled();

    await act(async () => playCalls[1]?.finish());
    await waitFor(() => expect(shownLevel()).toBe("3"), { timeout: WAIT_MS });
    expect(screen.getByTestId("scene").getAttribute("data-held")).toBe("false");
    expect(cleanupSpy).toHaveBeenCalled();
  });

  it("keeps the first frozen model when a second action begins during a hold", async () => {
    const host = renderHost(liveAt(4));
    let first: ActionTicket | undefined;
    let second: ActionTicket | undefined;
    act(() => {
      first = host.observer().begin({ kind: "cancel", subscriptionId: "sub-1" });
    });
    act(() => host.update(liveAt(3)));
    act(() => {
      second = host.observer().begin({ kind: "cancel", subscriptionId: "sub-2" });
    });
    expect(shownLevel()).toBe("4");

    act(() => host.observer().fail(first as ActionTicket));
    expect(shownLevel()).toBe("4");

    act(() => host.observer().fail(second as ActionTicket));
    expect(shownLevel()).toBe("3");
    expect(playCalls).toHaveLength(0);
  });

  it("renders the Moment_Layer as a hidden, click-through direct child of document.body and removes it on unmount", () => {
    const { container, unmount } = render(<MomentHost live={liveAt(4)}>{() => null}</MomentHost>);
    const layer = document.body.querySelector<HTMLElement>('[data-part="moment-layer"]');
    expect(layer).not.toBeNull();
    expect(layer?.parentElement).toBe(document.body);
    expect(container.querySelector('[data-part="moment-layer"]')).toBeNull();
    expect(layer?.getAttribute("aria-hidden")).toBe("true");
    expect(layer?.className).toContain("pointer-events-none");
    unmount();
    expect(document.body.querySelector('[data-part="moment-layer"]')).toBeNull();
  });

  it.each([
    ["pointerdown", (target: Element) => fireEvent.pointerDown(target)],
    ["keydown", (target: Element) => fireEvent.keyDown(target, { key: "a" })],
  ])("finishes every Moment on %s without stopping the event", async (_name, fire) => {
    const host = renderHost(liveAt(4));
    let first: ActionTicket | undefined;
    let second: ActionTicket | undefined;
    act(() => {
      first = host.observer().begin({ kind: "cancel", subscriptionId: "sub-1" });
      second = host.observer().begin({ kind: "cancel", subscriptionId: "sub-2" });
    });
    act(() => host.update(liveAt(3)));
    await act(async () => {
      host.observer().resolve(first as ActionTicket, cancelOutcome("sub-1"));
      host.observer().resolve(second as ActionTicket, cancelOutcome("sub-2"));
    });
    await waitFor(() => expect(playCalls).toHaveLength(1));
    expect(shownLevel()).toBe("4");

    const bubbled = vi.fn();
    const target = screen.getByTestId("scene");
    target.addEventListener("pointerdown", bubbled);
    target.addEventListener("keydown", bubbled);
    let notCancelled = true;
    act(() => {
      notCancelled = fire(target) as boolean;
    });

    expect(notCancelled).toBe(true);
    expect(bubbled).toHaveBeenCalledTimes(1);
    expect(playCalls[0]?.signal.aborted).toBe(true);
    await waitFor(() => expect(shownLevel()).toBe("3"));
    await new Promise((resolve) => setTimeout(resolve, GAP_WAIT_MS));
    expect(playCalls).toHaveLength(1);
  });

  it("drops pending requests and stops playing when it unmounts", async () => {
    const host = renderHost(liveAt(4));
    let first: ActionTicket | undefined;
    let second: ActionTicket | undefined;
    act(() => {
      first = host.observer().begin({ kind: "cancel", subscriptionId: "sub-1" });
      second = host.observer().begin({ kind: "cancel", subscriptionId: "sub-2" });
    });
    await act(async () => {
      host.observer().resolve(first as ActionTicket, cancelOutcome("sub-1"));
      host.observer().resolve(second as ActionTicket, cancelOutcome("sub-2"));
    });
    await waitFor(() => expect(playCalls).toHaveLength(1));

    act(() => host.unmount());
    expect(playCalls[0]?.signal.aborted).toBe(true);
    expect(cleanupSpy).toHaveBeenCalled();

    playCalls[0]?.finish();
    await new Promise((resolve) => setTimeout(resolve, GAP_WAIT_MS));
    expect(playCalls).toHaveLength(1);
  });
});
