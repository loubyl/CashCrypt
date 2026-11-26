"use client";

import { useRef, useState, type FormEvent } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/SegmentedControl";
import { useActionToast } from "@/components/feedback/useActionToast";
import { useCryptActions } from "@/hooks/useCryptActions";
import { useNow } from "@/hooks/useNow";
import { SMALL_EXPENSE_THRESHOLD_CENTS } from "@/lib/haunting/config";
import { EXPENSE_CLAUSE, GHOST_EXPENSE_CLAUSE } from "@/lib/utils/lightClause";
import { formatCentsShort, parseMoneyToCents } from "@/lib/utils/cents";
import { useFocusFirstInvalid } from "./useFocusFirstInvalid";

const SHEET_TITLE = "Add expense";
const EMPTY_AMOUNT_ERROR = "Enter the amount.";
const ZERO_AMOUNT_ERROR = "Enter an amount above $0.";
const EMPTY_DESCRIPTION_ERROR = "Describe what it was.";
const GENERIC_ERROR = "Could not save the expense. Try again.";
const CATEGORY_LABEL = "Category";
const DEFAULT_CATEGORY = "Coffee";

const CATEGORY_OPTIONS: readonly SegmentedControlOption[] = [
  { value: "Coffee", label: "Coffee" },
  { value: "Food", label: "Food" },
  { value: "Transport", label: "Transport" },
  { value: "Other", label: "Other" },
];

export type AddExpenseSheetProps = {
  open: boolean;
  onClose: () => void;
};

type FieldErrors = { amount?: string; description?: string };

type ExpenseFormProps = { onClose: () => void };

function ExpenseForm({ onClose }: ExpenseFormProps) {
  const { addTransaction } = useCryptActions();
  const now = useNow();
  const showToast = useActionToast();
  const [amountText, setAmountText] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, attempt);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const cents = parseMoneyToCents(amountText);
    const trimmed = description.trim();
    const found: FieldErrors = {};
    if (amountText.trim() === "" || cents === null) found.amount = EMPTY_AMOUNT_ERROR;
    else if (cents <= 0) found.amount = ZERO_AMOUNT_ERROR;
    if (trimmed === "") found.description = EMPTY_DESCRIPTION_ERROR;
    if (cents === null || cents <= 0 || trimmed === "" || now === null) {
      setErrors(found.amount || found.description ? found : { amount: GENERIC_ERROR });
      setAttempt((count) => count + 1);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const result = await addTransaction({
      amountCents: cents,
      description: trimmed,
      category,
      date: now,
    });
    setSubmitting(false);
    if (!result.ok) {
      const message =
        result.error.kind === "validation"
          ? (result.error.errors[0]?.message ?? GENERIC_ERROR)
          : result.error.message;
      setErrors({ amount: message });
      return;
    }
    onClose();
    const amount = formatCentsShort(cents);
    const isGhost = cents < SMALL_EXPENSE_THRESHOLD_CENTS;
    showToast({
      tone: "success",
      base: isGhost ? `Ghost added: ${amount}` : `Expense added: ${amount}`,
      effect: { kind: "fixed", clause: isGhost ? GHOST_EXPENSE_CLAUSE : EXPENSE_CLAUSE },
      destination: { list: "transactions", rowId: result.value.id, tag: "new" },
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input
        label="Amount"
        variant="money"
        fill="raised"
        value={amountText}
        error={errors.amount}
        onChange={(event) => {
          setAmountText(event.target.value);
          setErrors((current) => ({ ...current, amount: undefined }));
        }}
      />
      <Input
        label="What was it?"
        fill="raised"
        value={description}
        error={errors.description}
        onChange={(event) => {
          setDescription(event.target.value);
          setErrors((current) => ({ ...current, description: undefined }));
        }}
      />
      <SegmentedControl
        aria-label={CATEGORY_LABEL}
        options={CATEGORY_OPTIONS}
        value={category}
        onChange={setCategory}
      />
      <Button type="submit" variant="primary" size="lg" loading={submitting}>
        Save expense
      </Button>
    </form>
  );
}

export function AddExpenseSheet({ open, onClose }: AddExpenseSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={SHEET_TITLE}>
      <ExpenseForm onClose={onClose} />
    </BottomSheet>
  );
}
