"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/common/Skeleton";
import { DemoControls } from "@/components/demo/DemoControls";
import { OnboardingSheet } from "@/components/sheets/OnboardingSheet";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/ToastRegion";
import { useActionToast } from "@/components/feedback/useActionToast";
import { useCrypt } from "@/hooks/useCrypt";
import { useCryptActions } from "@/hooks/useCryptActions";
import { useCryptData } from "@/hooks/useCryptData";
import { useDemo } from "@/hooks/useDemo";
import { centsToMoneyText, parseMoneyToCents } from "@/lib/utils/cents";
import { validateIncome } from "@/lib/validation/inputs";

const PAGE_TITLE = "Settings";
const SKELETON_LINES = 3;
const HOME_PATH = "/";
const MODE_DEMO = "demo";
const MODE_REAL = "real";
const CRYPT_OPTIONS: readonly SegmentedControlOption[] = [
  { value: MODE_DEMO, label: "Demo crypt" },
  { value: MODE_REAL, label: "My crypt" },
];
const INCOME_SAVED_MESSAGE = "Income saved";
const INCOME_EMPTY_ERROR = "Enter your monthly income.";
const GENERIC_ERROR = "Something went wrong. Try again.";
const DEMO_ERROR = "The demo crypt could not be opened. Check that your browser allows local storage.";
const CLEAR_HINT = "Switch to your own crypt to use this.";
// The Card title already says "Crypt"; the control's own name says what it sets.
const CRYPT_CONTROL_LABEL = "Active crypt";
const CLEAR_TITLE = "Clear all data?";
const CLEAR_DESCRIPTION =
  "This deletes your income, debts, subscriptions, transactions and weekly plans from this browser. This can't be undone.";

type IncomeFormProps = { initialCents: number };

function IncomeForm({ initialCents }: IncomeFormProps) {
  const { setIncome } = useCryptActions();
  const showToast = useActionToast();
  const [text, setText] = useState(centsToMoneyText(initialCents));
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (text.trim() === "") {
      setError(INCOME_EMPTY_ERROR);
      return;
    }
    const parsed = parseMoneyToCents(text);
    const checked = validateIncome(parsed ?? Number.NaN);
    if (!checked.ok) {
      setError(checked.errors[0]?.message ?? INCOME_EMPTY_ERROR);
      return;
    }
    setError(undefined);
    setSaving(true);
    const result = await setIncome(checked.value);
    setSaving(false);
    if (!result.ok) {
      setError(
        result.error.kind === "validation"
          ? (result.error.errors[0]?.message ?? GENERIC_ERROR)
          : result.error.message,
      );
      return;
    }
    showToast({
      tone: "success",
      base: INCOME_SAVED_MESSAGE,
      effect: { kind: "light", change: result.change },
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-3 flex flex-col gap-4">
      <Input
        label="Monthly income"
        variant="money"
        fill="raised"
        value={text}
        error={error}
        onChange={(event) => {
          setText(event.target.value);
          setError(undefined);
        }}
      />
      <Button type="submit" variant="primary" size="lg" loading={saving}>
        Save income
      </Button>
    </form>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { status, hasRealProfile, setMode, clearMode } = useCrypt();
  const data = useCryptData();
  const { clearAll } = useCryptActions();
  const { enterDemo } = useDemo();
  const cryptLabelId = useId();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  if (data.status === "loading") {
    return (
      <main className="flex flex-col" aria-busy="true">
        <PageHeader title={PAGE_TITLE} />
        <Skeleton lines={SKELETON_LINES} />
      </main>
    );
  }

  const inDemo = status === "demo";
  const incomeCents = data.rows.profile?.monthlyIncomeCents ?? 0;

  const handleCryptChange = async (value: string) => {
    if (value === MODE_DEMO) {
      try {
        await enterDemo();
      } catch {
        toast.show({ tone: "danger", message: DEMO_ERROR });
      }
      return;
    }
    if (hasRealProfile) {
      setMode(MODE_REAL);
      return;
    }
    setOnboardingOpen(true);
  };

  const handleClear = async () => {
    setClearing(true);
    const result = await clearAll();
    setClearing(false);
    if (!result.ok) {
      toast.show({ tone: "danger", message: GENERIC_ERROR });
      return;
    }
    setConfirmOpen(false);
    clearMode();
    router.replace(HOME_PATH);
  };

  return (
    <main className="flex flex-col gap-3">
      <PageHeader title={PAGE_TITLE} />
      <Card title="Income">
        <IncomeForm key={incomeCents} initialCents={incomeCents} />
      </Card>
      <Card title="Crypt">
        <p id={cryptLabelId} className="sr-only">
          {CRYPT_CONTROL_LABEL}
        </p>
        <SegmentedControl
          aria-labelledby={cryptLabelId}
          options={CRYPT_OPTIONS}
          value={inDemo ? MODE_DEMO : MODE_REAL}
          onChange={(value) => void handleCryptChange(value)}
        />
      </Card>
      {inDemo ? <DemoControls /> : null}
      <Card title="Your data">
        <div className="mt-1 flex flex-col gap-2">
          <Button
            type="button"
            variant="danger"
            disabled={inDemo}
            aria-describedby={inDemo ? `${cryptLabelId}-clear-hint` : undefined}
            onClick={() => setConfirmOpen(true)}
          >
            Clear all data
          </Button>
          {inDemo ? (
            <p id={`${cryptLabelId}-clear-hint`} className="text-caption text-ink-secondary">
              {CLEAR_HINT}
            </p>
          ) : null}
        </div>
      </Card>
      <BottomSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title={CLEAR_TITLE}>
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink-secondary">{CLEAR_DESCRIPTION}</p>
          <Button type="button" variant="danger" size="lg" loading={clearing} onClick={() => void handleClear()}>
            Clear all data
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={() => setConfirmOpen(false)}>
            Keep my data
          </Button>
        </div>
      </BottomSheet>
      <OnboardingSheet
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onCreated={() => setOnboardingOpen(false)}
      />
    </main>
  );
}
