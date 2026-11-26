"use client";

import { useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { Landmark } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { useActionToast } from "@/components/feedback/useActionToast";
import { useCryptActions } from "@/hooks/useCryptActions";
import { INITIAL_FOCUS_ATTRIBUTE } from "@/lib/utils/focusTrap";
import { centsToMoneyText, formatCents, formatCentsShort, parseMoneyToCents } from "@/lib/utils/cents";
import { getExtraAboveMinimum, getPaymentPrefill } from "@/lib/utils/planView";
import { validatePaymentAmount } from "@/lib/validation/inputs";
import { useFocusFirstInvalid } from "./useFocusFirstInvalid";
import type { DebtRow } from "@/types/finance";

const SHEET_TITLE = "Log payment";
const PICKER_TITLE = "Choose a debt";
const EMPTY_AMOUNT_ERROR = "Enter the payment amount.";
const GENERIC_ERROR = "Could not save the payment. Try again.";

export type LogPaymentSheetProps = {
  open: boolean;
  onClose: () => void;
  debts: readonly DebtRow[];
  /** Skips the picker and shows this Debt. */
  initialDebtId?: string;
  /** Pre-fill in cents (minimum plus suggested amount), limited to the balance. */
  prefillCents?: number;
};

type PaymentFormProps = {
  debt: DebtRow;
  prefillCents?: number;
  onClose: () => void;
  /** Receives the amount input so the sheet can focus it after a Debt is picked. */
  amountRef?: RefObject<HTMLInputElement | null>;
};

function PaymentForm({ debt, prefillCents, onClose, amountRef }: PaymentFormProps) {
  const { logPayment } = useCryptActions();
  const showToast = useActionToast();
  const initialCents =
    prefillCents === undefined ? getPaymentPrefill(debt) : Math.min(Math.max(prefillCents, 0), debt.balanceCents);
  const [text, setText] = useState(initialCents > 0 ? centsToMoneyText(initialCents) : "");
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, attempt);

  const parsed = parseMoneyToCents(text);
  const extraCents = parsed === null ? 0 : getExtraAboveMinimum(parsed, debt.minimumPaymentCents);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (text.trim() === "" || parsed === null) {
      setError(EMPTY_AMOUNT_ERROR);
      setAttempt((count) => count + 1);
      return;
    }
    const checked = validatePaymentAmount(parsed, debt);
    if (!checked.ok) {
      setError(checked.errors[0]?.message ?? GENERIC_ERROR);
      setAttempt((count) => count + 1);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    const result = await logPayment(debt.id, checked.value);
    setSubmitting(false);
    if (!result.ok) {
      setError(
        result.error.kind === "validation"
          ? (result.error.errors[0]?.message ?? GENERIC_ERROR)
          : result.error.message,
      );
      return;
    }
    onClose();
    showToast({
      tone: "success",
      base: `Payment saved. ${formatCentsShort(checked.value)} off your balance`,
      effect: { kind: "light", change: result.change },
      destination: { list: "debts", rowId: debt.id, tag: "updated" },
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-body-lg text-ink">{debt.name}</p>
        <p className="text-body text-ink-secondary">
          Balance {formatCentsShort(debt.balanceCents)}. Minimum {formatCentsShort(debt.minimumPaymentCents)}/mo.
        </p>
      </div>
      <Input
        ref={amountRef}
        label="Payment amount"
        variant="money"
        fill="raised"
        value={text}
        error={error}
        onChange={(event) => {
          setText(event.target.value);
          setError(undefined);
        }}
      />
      {/* The green hint would contradict an error, so it only shows while the amount is valid. */}
      {extraCents > 0 && error === undefined ? (
        <p className="text-body text-ecto">{formatCentsShort(extraCents)} goes above your minimum</p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" loading={submitting}>
        Save payment
      </Button>
    </form>
  );
}

export function LogPaymentSheet({
  open,
  onClose,
  debts,
  initialDebtId,
  prefillCents,
}: LogPaymentSheetProps) {
  const [pickedId, setPickedId] = useState<string | undefined>(undefined);
  const payable = debts.filter((debt) => debt.balanceCents > 0);
  const givenDebt = initialDebtId === undefined ? undefined : debts.find((debt) => debt.id === initialDebtId);
  const pickedDebt = payable.find((debt) => debt.id === pickedId);
  const selected = givenDebt ?? pickedDebt ?? (payable.length === 1 ? payable[0] : undefined);
  const usePrefill = givenDebt !== undefined;
  const amountRef = useRef<HTMLInputElement>(null);

  // Only a pick from the picker moves focus here. A sheet opened on a given Debt gets its focus
  // from BottomSheet, which also records the element to return to.
  useLayoutEffect(() => {
    if (pickedId === undefined) return;
    const input = amountRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [pickedId]);

  const handleClose = () => {
    setPickedId(undefined);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={handleClose} title={selected ? SHEET_TITLE : PICKER_TITLE}>
      {selected ? (
        <PaymentForm
          key={selected.id}
          debt={selected}
          prefillCents={usePrefill ? prefillCents : undefined}
          onClose={handleClose}
          amountRef={amountRef}
        />
      ) : (
        <div className="flex flex-col">
          {payable.map((debt, index) => (
            <ListRow
              key={debt.id}
              {...(index === 0 ? { [INITIAL_FOCUS_ATTRIBUTE]: "" } : {})}
              icon={Landmark}
              tone="blood"
              title={debt.name}
              // Subtitles are text (formatCentsShort); only the amount column keeps cents.
              subtitle={`Minimum ${formatCentsShort(debt.minimumPaymentCents)}/mo`}
              amount={formatCents(debt.balanceCents)}
              onClick={() => setPickedId(debt.id)}
            />
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
