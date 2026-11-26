"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ExorcismActionRow } from "@/components/ui/ExorcismActionRow";
import { useToast } from "@/components/ui/ToastRegion";
import { useActionToast } from "@/components/feedback/useActionToast";
import type { MutationResult } from "@/hooks/useCryptActions";
import { getRowDomId } from "@/lib/utils/destinations";
import { formatCentsShort } from "@/lib/utils/cents";
import { getPlanActionSubtitle, getToastForCompletion, type DoItTarget } from "@/lib/utils/planView";
import type { HighlightTag } from "@/lib/utils/destinations";
import type { StoredPlanAction } from "@/types/finance";

const TOGGLE_ERROR_MESSAGE = "Could not save that action. Try again.";
const DO_IT_LABEL = "Do it";
const CANCEL_DESCRIPTION = "Opens the cancel confirmation";
const PAY_DESCRIPTION = "Opens the payment sheet";
// Aligns the Do it button with the text column: 44px checkbox target plus the 12px row gap.
const DO_IT_WRAPPER_CLASSES = "-mt-1 mb-2 pl-14";

/** DOM id of a plan row's checkbox. */
export function getPlanRowId(actionId: string): string {
  return getRowDomId("plan", actionId);
}

function getCheckboxDescription(target: DoItTarget | null): string | undefined {
  if (target === null) return undefined;
  return target.kind === "cancel" ? CANCEL_DESCRIPTION : PAY_DESCRIPTION;
}
export type ExorcismPlanActionProps = {
  action: StoredPlanAction;
  /** Marks the row as just added or changed. */
  highlight?: HighlightTag;
  /** Non-null only while the action can still be done from here. */
  doItTarget: DoItTarget | null;
  onDoIt: (action: StoredPlanAction, target: DoItTarget) => void;
  toggleAction: (actionId: string, next: boolean) => Promise<MutationResult<void>>;
};

export function ExorcismPlanAction({
  action,
  highlight,
  doItTarget,
  onDoIt,
  toggleAction,
}: ExorcismPlanActionProps) {
  const toast = useToast();
  const showToast = useActionToast();
  const [busy, setBusy] = useState(false);
  const impactCents = action.monthlyAmountCents;
  const impactText = impactCents > 0 ? formatCentsShort(impactCents) : undefined;

  const handleToggle = async (next: boolean) => {
    if (busy) return;
    // Record the change through its sheet; Auto_Completion marks the action done afterwards.
    if (next && doItTarget !== null) {
      onDoIt(action, doItTarget);
      return;
    }
    setBusy(true);
    const result = await toggleAction(action.id, next);
    setBusy(false);
    if (!result.ok) {
      toast.show({ tone: "danger", message: TOGGLE_ERROR_MESSAGE });
      return;
    }
    if (next) {
      showToast({
        tone: "success",
        base: getToastForCompletion(action),
        effect: { kind: "light", change: result.change },
        destination: { list: "plan", rowId: action.id, tag: "updated" },
      });
    }
  };

  return (
    <div data-plan-action={action.id}>
      <ExorcismActionRow
        id={getPlanRowId(action.id)}
        title={action.title}
        subtitle={getPlanActionSubtitle(action)}
        impactText={impactText}
        done={action.done}
        pending={busy}
        highlight={highlight}
        description={getCheckboxDescription(doItTarget)}
        onToggle={handleToggle}
      />
      {doItTarget !== null ? (
        <div className={DO_IT_WRAPPER_CLASSES}>
          <Button
            type="button"
            variant="secondary"
            size="md"
            aria-label={`${DO_IT_LABEL}: ${action.title}`}
            onClick={() => onDoIt(action, doItTarget)}
          >
            {DO_IT_LABEL}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
