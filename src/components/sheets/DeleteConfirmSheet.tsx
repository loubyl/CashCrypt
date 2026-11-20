"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastRegion";
import type { MutationResult } from "@/hooks/useCryptActions";

const KEEP_LABEL = "Keep it";
const ERROR_MESSAGE = "Could not delete that. Try again.";

export type DeleteConfirmSheetProps = {
  open: boolean;
  onClose: () => void;
  name: string;
  /** Confirm button label, for example "Delete debt" or "Delete subscription". */
  confirmLabel: string;
  /** Runs the deletion. The caller shows the success toast and moves focus. */
  onConfirm: () => Promise<MutationResult<void>>;
};

export function DeleteConfirmSheet({
  open,
  onClose,
  name,
  confirmLabel,
  onConfirm,
}: DeleteConfirmSheetProps) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFailed(false);
    const result = await onConfirm();
    setSubmitting(false);
    if (!result.ok) {
      setFailed(true);
      toast.show({ tone: "danger", message: ERROR_MESSAGE });
      return;
    }
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={`Delete ${name}?`}>
      <div className="flex flex-col gap-4">
        <p className="text-body text-ink">This can&apos;t be undone.</p>
        {failed ? (
          <p role="alert" className="text-body text-blood">
            {ERROR_MESSAGE}
          </p>
        ) : null}
        <Button type="button" variant="secondary" size="lg" disabled={submitting} onClick={onClose}>
          {KEEP_LABEL}
        </Button>
        <Button type="button" variant="danger" size="lg" loading={submitting} onClick={handleConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </BottomSheet>
  );
}
