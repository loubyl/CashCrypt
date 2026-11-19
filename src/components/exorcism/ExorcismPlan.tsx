"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/common/Skeleton";
import { CancelSubscriptionSheet } from "@/components/sheets/CancelSubscriptionSheet";
import { LogPaymentSheet } from "@/components/sheets/LogPaymentSheet";
import { useCryptData } from "@/hooks/useCryptData";
import { useExorcismPlan } from "@/hooks/useExorcismPlan";
import { getDoItTarget, type DoItTarget } from "@/lib/utils/planView";
import type { StoredPlanAction } from "@/types/finance";
import { ExorcismPlanAction, getPlanRowId } from "./ExorcismPlanAction";

const SKELETON_LINES = 3;
const FOCUS_DELAY_MS = 0;

export type ExorcismPlanVariant = "card" | "page";

export type ExorcismPlanProps = {
  variant: ExorcismPlanVariant;
};

type ActiveDoIt = {
  actionId: string;
  target: DoItTarget;
  /** Sheet is shown; kept false (not cleared) after close so the sheet can finish closing. */
  open: boolean;
};

export function ExorcismPlan({ variant }: ExorcismPlanProps) {
  const { status, plan, weekKey, toggleAction } = useExorcismPlan();
  const data = useCryptData();
  const [active, setActive] = useState<ActiveDoIt | null>(null);
  // Row waiting for focus once its Do it button has gone (Auto_Completion done).
  const [pendingFocusActionId, setPendingFocusActionId] = useState<string | null>(null);

  const rows = data.rows;
  const actions = plan?.actions ?? [];
  const pendingAction = actions.find((action) => action.id === pendingFocusActionId);
  const pendingTargetGone =
    pendingAction !== undefined &&
    rows !== null &&
    getDoItTarget(pendingAction, rows) === null;
  const sheetClosed = active === null || !active.open;

  useEffect(() => {
    if (pendingAction === undefined || weekKey === null || !pendingTargetGone || !sheetClosed) return;
    const rowId = getPlanRowId(weekKey, pendingAction.id);
    // Wait one tick so the sheet's own focus restore runs first.
    const timer = window.setTimeout(() => {
      document.getElementById(rowId)?.focus();
      setPendingFocusActionId(null);
    }, FOCUS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pendingAction, pendingTargetGone, sheetClosed, weekKey]);

  if (status === "loading" || plan === null || weekKey === null || rows === null) {
    return <Skeleton lines={SKELETON_LINES} />;
  }

  const handleDoIt = (action: StoredPlanAction, target: DoItTarget) => {
    setPendingFocusActionId(action.id);
    setActive({ actionId: action.id, target, open: true });
  };
  const handleClose = () => setActive((current) => (current ? { ...current, open: false } : null));

  const activeAction = active ? actions.find((action) => action.id === active.actionId) : undefined;
  const activeTarget = active?.target;
  const subscription =
    activeTarget?.kind === "cancel"
      ? rows.subscriptions.find((row) => row.id === activeTarget.subscriptionId)
      : undefined;

  return (
    <div data-variant={variant} className="flex flex-col">
      {actions.map((action) => (
        <ExorcismPlanAction
          key={action.id}
          weekKey={weekKey}
          action={action}
          doItTarget={getDoItTarget(action, rows)}
          onDoIt={handleDoIt}
          toggleAction={toggleAction}
        />
      ))}
      {active?.target.kind === "cancel" && subscription !== undefined && activeAction !== undefined ? (
        <CancelSubscriptionSheet
          open={active.open}
          onClose={handleClose}
          subscriptionId={subscription.id}
          name={subscription.name}
          monthlyCents={activeAction.monthlyAmountCents}
        />
      ) : null}
      {active?.target.kind === "pay" ? (
        <LogPaymentSheet
          open={active.open}
          onClose={handleClose}
          debts={rows.debts}
          initialDebtId={active.target.debtId}
          prefillCents={active.target.prefillCents}
        />
      ) : null}
    </div>
  );
}
