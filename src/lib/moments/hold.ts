/**
 * Pure hold state machine for the Moment observer.
 *
 * While an action's Moments play, the Scene keeps drawing a frozen model.
 * The first frozen model is kept when a second action begins. The hold is
 * released only when no ticket awaits settle and the queue is idle.
 * Generic over the frozen model type; no React, DOM, GSAP, clock or random.
 */

export type HoldState<M> = {
  frozen: M | null;
  awaiting: number;
  queueIdle: boolean;
};

export type HoldEvent<M> =
  | { type: "begin"; live: M; freeze: boolean }
  | { type: "settled" }
  | { type: "queueBusy" }
  | { type: "queueIdle" };

const NO_AWAITING = 0;
const ONE_TICKET = 1;

export function createInitialHoldState<M>(): HoldState<M> {
  return { frozen: null, awaiting: NO_AWAITING, queueIdle: true };
}

function releaseIfDone<M>(state: HoldState<M>): HoldState<M> {
  if (state.awaiting === NO_AWAITING && state.queueIdle && state.frozen !== null) {
    return { ...state, frozen: null };
  }
  return state;
}

export function holdReducer<M>(state: HoldState<M>, event: HoldEvent<M>): HoldState<M> {
  switch (event.type) {
    case "begin":
      return {
        ...state,
        awaiting: state.awaiting + ONE_TICKET,
        frozen: state.frozen ?? (event.freeze ? event.live : null),
      };
    case "settled":
      return releaseIfDone({
        ...state,
        awaiting: Math.max(NO_AWAITING, state.awaiting - ONE_TICKET),
      });
    case "queueBusy":
      return { ...state, queueIdle: false };
    case "queueIdle":
      return releaseIfDone({ ...state, queueIdle: true });
  }
}
