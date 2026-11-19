"use client";

import { useState, type FormEvent } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useCreateCrypt } from "@/hooks/useCryptActions";
import { parseMoneyToCents } from "@/lib/utils/cents";
import { validateIncome } from "@/lib/validation/inputs";

const GENERIC_ERROR = "Enter your monthly income.";

export type OnboardingSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Called after the Real_Crypt Profile is created and the mode is set. */
  onCreated?: () => void;
};

export function OnboardingSheet({ open, onClose, onCreated }: OnboardingSheetProps) {
  const createCrypt = useCreateCrypt();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const parsed = parseMoneyToCents(text);
    const checked = validateIncome(parsed ?? Number.NaN);
    if (!checked.ok) {
      setError(checked.errors[0]?.message ?? GENERIC_ERROR);
      return;
    }
    setError(undefined);
    setSubmitting(true);
    const result = await createCrypt(checked.value);
    setSubmitting(false);
    if (!result.ok) {
      setError(
        result.error.kind === "validation"
          ? (result.error.errors[0]?.message ?? GENERIC_ERROR)
          : result.error.message,
      );
      return;
    }
    onCreated?.();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Your monthly income">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Monthly income"
          variant="money"
          fill="raised"
          value={text}
          error={error}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit" variant="primary" size="lg" loading={submitting}>
          Create my crypt
        </Button>
      </form>
    </BottomSheet>
  );
}
