import type { DecayLevel } from "@/lib/haunting/config";

/** Structural copy of the DOM rect (no DOM type), so this module stays framework-agnostic. */
export type RectLike = { left: number; top: number; width: number; height: number };

/** Where a cancel Moment plays: on a drawn zombie, or on the overflow marker. */
export type CancelTarget = "zombie" | "overflow";

/** One Moment to play. Plain data; consumed by the queue and by the Moment geometry. */
export type MomentRequest =
  | { kind: "cancel"; subscriptionId: string; name: string; monthlyCents: number; target: CancelTarget }
  | { kind: "payment"; origin: RectLike | null; hasCrack: boolean }
  | { kind: "sigil" }
  | { kind: "exorcismComplete" }
  | { kind: "level"; from: DecayLevel; to: DecayLevel };

/** Result of a user action, as reported by the action observer on `resolve`. */
export type ActionOutcome =
  | {
      kind: "cancel";
      subscriptionId: string;
      changed: boolean;
      monthlySavedCents: number;
      completedActionId: string | null;
    }
  | {
      kind: "payment";
      extraPrincipalCents: number;
      completedActionId: string | null;
      origin: RectLike | null;
    }
  | { kind: "planToggle"; actionId: string; next: boolean; lightDelta: number }
  | { kind: "expense"; transactionId: string; small: boolean; poltergeistAfter: boolean };

/** One plan action as seen at `begin()`. */
export type PlanActionView = { id: string; kind: string; done: boolean };

/** Live data captured by the observer at `begin()`, before the mutation runs. */
export type ActionContext = {
  level: DecayLevel;
  poltergeistPresent: boolean;
  drawnZombieIds: readonly string[];
  crackCount: number;
  subscriptionNames: Readonly<Record<string, string>>;
  planActions: readonly PlanActionView[];
};
