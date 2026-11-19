"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastRegion";
import { useCryptActions } from "@/hooks/useCryptActions";
import { formatCentsShort } from "@/lib/utils/cents";

const SHEET_TITLE = "Cancel subscription";
const KEEP_LABEL = "Keep it";
const ERROR_MESSAGE = "Could not cancel that subscription. Try again.";

export type CancelSubscriptionSheetProps = {
  open: boolean;
  onClose: () => void;
  subscriptionId: string;
  name: string;
  /** Normalized monthly cost in integer cents. */
  monthlyCents: number;
  /** Called after the subscription is canceled and the success toast is shown. */
  onCanceled?: () => void;
};

export function CancelSubscriptionSheet({
  open,
  onClose,
  subscriptionId,
  name,
  monthlyCents,
  onCanceled,
}: CancelSubscriptionSheetProps) {
  const { cancelSubscription } = useCryptActions();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFailed(false);
    const result = await cancelSubscription(subscriptionId);
    setSubmitting(false);
    if (!result.ok) {
      setFailed(true);
      toast.show({ tone: "danger", message: ERROR_MESSAGE });
      return;
    }
    const saved = result.value.changed ? result.value.monthlySavedCents : monthlyCents;
    toast.show({ tone: "success", message: `+${formatCentsShort(saved)}/mo saved` });
    onCanceled?.();
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={SHEET_TITLE}>
      <div className="flex flex-col gap-4">
        <p className="text-body text-ink">
          Cancel {name} — saves {formatCentsShort(monthlyCents)}/mo
        </p>
        {failed ? (
          <p role="alert" className="text-body text-blood">
            {ERROR_MESSAGE}
          </p>
        ) : null}
        <Button type="button" variant="danger" size="lg" loading={submitting} onClick={handleConfirm}>
          Cancel subscription
        </Button>
        <Button type="button" variant="secondary" size="lg" disabled={submitting} onClick={onClose}>
          {KEEP_LABEL}
        </Button>
      </div>
    </BottomSheet>
  );
}
