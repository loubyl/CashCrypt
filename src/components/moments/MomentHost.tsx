"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { ActionObserverContext } from "@/hooks/useActionObserver";
import type { ActionObserver, ActionTicket, ObservedAction } from "@/hooks/useActionObserver";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { createInitialHoldState, holdReducer } from "@/lib/moments/hold";
import type { HoldEvent, HoldState } from "@/lib/moments/hold";
import { createMomentQueue } from "@/lib/moments/queue";
import type { MomentQueue } from "@/lib/moments/queue";
import { planLevelMoment, planMoments } from "@/lib/moments/requests";
import type { ActionContext, ActionOutcome, PlanActionView, RectLike } from "@/lib/moments/types";
import {
  MOMENT_GAP_MS,
  MOMENT_HARD_CAP_MS,
  MOMENT_QUEUE_MAX_PENDING,
  SETTLE_TIMEOUT_MS,
  SHEET_CLOSE_WAIT_MAX_MS,
} from "@/lib/scene";
import type { SceneModel } from "@/lib/scene";
import { playMoment } from "./momentLoader";
import type { MomentTarget } from "./momentLoader";
import { isSheetPresent, waitForSheetsClosed } from "./sheetGate";

/** Live data the host reads at `begin` and at settle. */
export type MomentHostLive = {
  model: SceneModel;
  /** Changes identity every time the engine recomputes (the live `HouseState`). */
  liveKey: object;
  subscriptionNames: Readonly<Record<string, string>>;
  planActions: readonly PlanActionView[];
};

/** What the children need to draw the Scene. */
export type MomentHostView = {
  /** The frozen model while a hold is active, else the live model. */
  model: SceneModel;
  held: boolean;
  /** Runs the registered Moment cleanups; `HouseScene` calls it from a layout effect on release. */
  onRelease: () => void;
};

export type MomentHostProps = {
  live: MomentHostLive;
  children: (view: MomentHostView) => ReactNode;
};

type TicketEntry = {
  ctx: ActionContext;
  origin: RectLike | null;
  version: number;
  epoch: number;
};

const SCENE_SELECTOR = '[data-part="scene"]';
const NO_AWAITING = 0;
// z-50 matches the ToastRegion and sits above the sheets (z-40) and the TabBar (z-30).
// The layer ignores pointer events, so sharing the toast level blocks nothing.
const LAYER_CLASSES = "pointer-events-none fixed inset-0 z-50";

const subscribeNever = (): (() => void) => () => undefined;
const getClientMounted = (): boolean => true;
const getServerMounted = (): boolean => false;

type SceneHold = HoldState<SceneModel>;
type SceneHoldEvent = HoldEvent<SceneModel>;

function reduceHold(state: SceneHold, event: SceneHoldEvent): SceneHold {
  return holdReducer<SceneModel>(state, event);
}

function toRectLike(element: Element | null): RectLike | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

function buildContext(live: MomentHostLive): ActionContext {
  return {
    level: live.model.level,
    poltergeistPresent: live.model.poltergeist !== null,
    drawnZombieIds: live.model.zombies.map((zombie) => zombie.id),
    crackCount: live.model.features.crackCount,
    subscriptionNames: live.subscriptionNames,
    planActions: live.planActions,
  };
}

/**
 * Observer, hold, queue and Moment_Layer of the Dashboard. Provides the
 * `ActionObserver` to the hooks below it and hands the Scene the model to draw.
 */
export function MomentHost({ live, children }: MomentHostProps) {
  const reduced = useReducedMotionPreference();
  // False on the server and during hydration, true afterwards: the portal needs `document`.
  const layerMounted = useSyncExternalStore(subscribeNever, getClientMounted, getServerMounted);
  const [hold, dispatch] = useReducer(reduceHold, undefined, createInitialHoldState<SceneModel>);

  const liveRef = useRef(live);
  const reducedRef = useRef(reduced);
  const layerRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<MomentQueue | null>(null);
  const [cleanups] = useState<Array<() => void>>(() => []);
  const [tickets] = useState(() => new Map<number, TicketEntry>());
  const [waiters] = useState(() => new Set<() => void>());
  const nextTicketRef = useRef(0);
  const versionRef = useRef(0);
  const epochRef = useRef(0);
  const awaitingRef = useRef(NO_AWAITING);
  const cursorRef = useRef(live.model.level);
  const mountedRef = useRef(false);
  const dispatchRef = useRef(dispatch);

  useLayoutEffect(() => {
    liveRef.current = live;
    reducedRef.current = reduced;
    dispatchRef.current = dispatch;
  });

  // Each new live key means the engine recomputed: wake the tickets waiting to settle.
  const liveKey = live.liveKey;
  useLayoutEffect(() => {
    versionRef.current += 1;
    const waiting = [...waiters];
    waiters.clear();
    for (const wake of waiting) wake();
  }, [liveKey, waiters]);

  const runCleanups = useCallback((): void => {
    const pending = cleanups.splice(0);
    for (const cleanup of pending) {
      try {
        cleanup();
      } catch {
        // A failing cleanup must not block the others.
      }
    }
  }, [cleanups]);

  const released = hold.awaiting === NO_AWAITING && hold.queueIdle;
  useLayoutEffect(() => {
    if (released) runCleanups();
  }, [released, runCleanups]);

  // Queue lifecycle and target-mounted tracking.
  useLayoutEffect(() => {
    mountedRef.current = true;
    const getScene = (): HTMLElement | null =>
      layerRef.current?.ownerDocument.querySelector<HTMLElement>(SCENE_SELECTOR) ?? null;
    const queue = createMomentQueue({
      play: (request, signal) => {
        const scene = getScene();
        const layer = layerRef.current;
        if (!scene || !layer) return Promise.resolve();
        const target: MomentTarget = {
          scene,
          layer,
          getLiveModel: () => liveRef.current.model,
          registerCleanup: (cleanup) => {
            cleanups.push(cleanup);
          },
        };
        const start = (): Promise<void> => playMoment(request, target, signal, reducedRef.current === true);
        const doc = layer.ownerDocument;
        if (!isSheetPresent(doc)) return start();
        // A bottom sheet is open or closing: let it leave first so the Moment never plays under its scrim.
        return waitForSheetsClosed(doc, signal, SHEET_CLOSE_WAIT_MAX_MS).then(() => (signal.aborted ? undefined : start()));
      },
      isTargetMounted: () => mountedRef.current && layerRef.current !== null && getScene() !== null,
      shouldDrop: (request) => request.kind === "sigil" && liveRef.current.model.poltergeist === null,
      gapMs: MOMENT_GAP_MS,
      hardCapMs: MOMENT_HARD_CAP_MS,
      maxPending: MOMENT_QUEUE_MAX_PENDING,
      onBusy: () => dispatchRef.current({ type: "queueBusy" }),
      onIdle: () => dispatchRef.current({ type: "queueIdle" }),
    });
    queueRef.current = queue;
    return () => {
      mountedRef.current = false;
      queueRef.current = null;
      queue.destroy();
      waiters.clear();
      tickets.clear();
      runCleanups();
    };
  }, [runCleanups, cleanups, tickets, waiters]);

  // Skip listeners exist only while a Moment is queued or playing; they never stop the event.
  const queueBusy = !hold.queueIdle;
  useEffect(() => {
    if (!queueBusy) return;
    const skip = (): void => {
      epochRef.current += 1;
      cursorRef.current = liveRef.current.model.level;
      queueRef.current?.skipAll();
    };
    const options: AddEventListenerOptions = { capture: true, passive: true };
    document.addEventListener("pointerdown", skip, options);
    document.addEventListener("keydown", skip, options);
    document.addEventListener("visibilitychange", skip, options);
    return () => {
      document.removeEventListener("pointerdown", skip, options);
      document.removeEventListener("keydown", skip, options);
      document.removeEventListener("visibilitychange", skip, options);
    };
  }, [queueBusy]);

  const observer = useMemo<ActionObserver>(() => {
    const waitForSettle = (version: number): Promise<void> =>
      new Promise<void>((resolve) => {
        if (versionRef.current > version) {
          resolve();
          return;
        }
        const wake = (): void => {
          clearTimeout(timer);
          waiters.delete(wake);
          resolve();
        };
        const timer = setTimeout(wake, SETTLE_TIMEOUT_MS);
        waiters.add(wake);
      });

    const finishTicket = (id: number): void => {
      if (!tickets.delete(id)) return;
      awaitingRef.current = Math.max(NO_AWAITING, awaitingRef.current - 1);
      dispatchRef.current({ type: "settled" });
    };

    const settleTicket = async (id: number, entry: TicketEntry): Promise<void> => {
      await waitForSettle(entry.version);
      const queue = queueRef.current;
      if (!mountedRef.current || !queue || !tickets.has(id)) return;
      if (entry.epoch === epochRef.current) {
        const levelRequest = planLevelMoment(cursorRef.current, liveRef.current.model.level);
        if (levelRequest && levelRequest.kind === "level") {
          cursorRef.current = levelRequest.to;
          void queue.enqueue(levelRequest);
        }
      }
      finishTicket(id);
    };

    return {
      begin(action: ObservedAction): ActionTicket {
        const id = nextTicketRef.current + 1;
        nextTicketRef.current = id;
        const current = liveRef.current;
        const holdActive = awaitingRef.current > NO_AWAITING || queueRef.current?.state !== "idle";
        if (!holdActive) cursorRef.current = current.model.level;
        awaitingRef.current += 1;
        tickets.set(id, {
          ctx: buildContext(current),
          origin: action.kind === "payment" ? toRectLike(document.activeElement) : null,
          version: versionRef.current,
          epoch: epochRef.current,
        });
        dispatchRef.current({ type: "begin", live: current.model, freeze: reducedRef.current === false });
        return { id };
      },
      resolve(ticket: ActionTicket, outcome: ActionOutcome): void {
        const entry = tickets.get(ticket.id);
        const queue = queueRef.current;
        if (!entry || !queue) return;
        const full: ActionOutcome =
          outcome.kind === "payment" ? { ...outcome, origin: entry.origin } : outcome;
        for (const request of planMoments(full, entry.ctx)) void queue.enqueue(request);
        void settleTicket(ticket.id, entry);
      },
      fail(ticket: ActionTicket): void {
        finishTicket(ticket.id);
      },
    };
  }, [tickets, waiters]);

  return (
    <ActionObserverContext.Provider value={observer}>
      {children({ model: hold.frozen ?? live.model, held: hold.frozen !== null, onRelease: runCleanups })}
      {layerMounted
        ? createPortal(
            <div ref={layerRef} aria-hidden="true" data-part="moment-layer" className={LAYER_CLASSES} />,
            document.body,
          )
        : null}
    </ActionObserverContext.Provider>
  );
}
