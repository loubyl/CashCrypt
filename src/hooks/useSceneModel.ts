"use client";

import { useMemo } from "react";
import { useExorcismPlan } from "@/hooks/useExorcismPlan";
import { useHouseState } from "@/hooks/useHouseState";
import { normalizeSubscription, type HouseState } from "@/lib/haunting";
import { buildSceneModel } from "@/lib/scene";
import type { GraveyardEntry, SceneModel } from "@/lib/scene";
import type { StoredPlanAction, SubscriptionRow } from "@/types/finance";

const BOUND_ACTION_KIND = "reduce_small_expenses";

export type SceneModelResult =
  | { status: "loading"; model: null }
  | { status: "ready"; model: SceneModel; houseState: HouseState; boundFlag: boolean };

/** True when the plan of the current week has a done reduce_small_expenses action. */
function isBound(actions: readonly StoredPlanAction[] | undefined): boolean {
  return (actions ?? []).some((action) => action.kind === BOUND_ACTION_KIND && action.done === true);
}

/** Inactive subscriptions with a cancel date become tombstones. */
function toGraveyard(subscriptions: readonly SubscriptionRow[]): GraveyardEntry[] {
  const entries: GraveyardEntry[] = [];
  for (const sub of subscriptions) {
    if (sub.active || sub.canceledOn === undefined) continue;
    const normalized = normalizeSubscription({
      subscriptionId: sub.id,
      name: sub.name,
      amountCents: sub.amountCents,
      cadence: sub.cadence,
      usage: sub.usage,
      active: sub.active,
    });
    entries.push({
      subscriptionId: sub.id,
      name: sub.name,
      monthlyCostCents: normalized.monthlyCostCents,
      canceledOn: sub.canceledOn,
    });
  }
  return entries;
}

/** Live Scene_Model built from the House_State, the income, the graveyard and the Bound_Flag. */
export function useSceneModel(): SceneModelResult {
  const house = useHouseState();
  const { plan } = useExorcismPlan();

  const houseState = house.houseState;
  const monthlyIncomeCents = house.rows?.profile?.monthlyIncomeCents ?? 0;
  const subscriptions = house.rows?.subscriptions;
  const actions = plan?.actions;

  const graveyard = useMemo(() => toGraveyard(subscriptions ?? []), [subscriptions]);
  const boundFlag = useMemo(() => isBound(actions), [actions]);

  const model = useMemo(
    () =>
      houseState
        ? buildSceneModel({ houseState, monthlyIncomeCents, graveyard, bound: boundFlag })
        : null,
    [houseState, monthlyIncomeCents, graveyard, boundFlag],
  );

  if (!houseState || !model) return { status: "loading", model: null };
  return { status: "ready", model, houseState, boundFlag };
}
