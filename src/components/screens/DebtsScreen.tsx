"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Landmark, Plus } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/common/Skeleton";
import { DeleteConfirmSheet } from "@/components/sheets/DeleteConfirmSheet";
import { LogPaymentSheet } from "@/components/sheets/LogPaymentSheet";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { useToast } from "@/components/ui/ToastRegion";
import { useCryptActions } from "@/hooks/useCryptActions";
import { useCryptData } from "@/hooks/useCryptData";
import {
  aprFractionToPercent,
  aprPercentToFraction,
  centsToMoneyText,
  formatCents,
  formatCentsShort,
  parseMoneyToCents,
} from "@/lib/utils/cents";
import { sortDebtsByBalance } from "@/lib/utils/listViews";
import { validateDebtInput } from "@/lib/validation/inputs";
import type { DebtRow } from "@/types/finance";

const PAGE_TITLE = "Debts";
const SKELETON_LINES = 4;
const ADD_LABEL = "Add debt";
const SEPARATOR = " · ";
const PER_MONTH_SUFFIX = "/mo";
const EMPTY_TITLE = "No debts. The walls are holding.";
const EMPTY_DESCRIPTION = "Add a debt to see how paying it down brings the light back.";
const EMPTY_BALANCE_ERROR = "Enter the current balance.";
const INVALID_BALANCE_ERROR = "Enter a valid balance.";
const EMPTY_MINIMUM_ERROR = "Enter the minimum monthly payment.";
const INVALID_MINIMUM_ERROR = "Enter a valid minimum payment.";
const EMPTY_APR_ERROR = "Enter the interest rate.";
const INVALID_APR_ERROR = "Enter a valid interest rate.";
const GENERIC_ERROR = "Could not save the debt. Try again.";
const APR_PATTERN = /^-?\d+(\.\d+)?$/;
const APR_DEFAULT_TEXT = "";
const DEBTS_HEADING_ID = "debts-heading";
const DELETE_LABEL = "Delete debt";
const DELETED_MESSAGE = "Debt deleted";
const FOCUS_DELAY_MS = 0;

type FieldErrors = {
  name?: string;
  balance?: string;
  apr?: string;
  minimum?: string;
  form?: string;
};

type FormValues = { name: string; balance: string; apr: string; minimum: string };

const EMPTY_VALUES: FormValues = {
  name: "",
  balance: "",
  apr: APR_DEFAULT_TEXT,
  minimum: "",
};

function toFormValues(row: DebtRow): FormValues {
  return {
    name: row.name,
    balance: centsToMoneyText(row.balanceCents),
    apr: String(aprFractionToPercent(row.apr)),
    minimum: centsToMoneyText(row.minimumPaymentCents),
  };
}

function formatDebtSubtitle(row: DebtRow): string {
  return `APR ${aprFractionToPercent(row.apr)}%${SEPARATOR}Minimum ${formatCentsShort(row.minimumPaymentCents)}${PER_MONTH_SUFFIX}`;
}

const PAID_OFF_LABEL = "Paid off";

/** List row subtitle: "Paid off" once the balance is 0, otherwise the APR and minimum. */
function formatDebtRowSubtitle(row: DebtRow): string {
  return row.balanceCents === 0 ? PAID_OFF_LABEL : formatDebtSubtitle(row);
}

/** Parses the money text of a field. Returns the error text when it is empty or not money. */
function readMoneyField(
  text: string,
  emptyError: string,
  invalidError: string,
): { cents: number; error?: undefined } | { cents: number; error: string } {
  if (text.trim() === "") return { cents: Number.NaN, error: emptyError };
  const cents = parseMoneyToCents(text);
  if (cents === null) return { cents: Number.NaN, error: invalidError };
  return { cents };
}

/** Parses the APR percentage text. Range errors come from the validator. */
function readAprField(text: string): { fraction: number; error?: string } {
  const trimmed = text.trim();
  if (trimmed === "") return { fraction: Number.NaN, error: EMPTY_APR_ERROR };
  if (!APR_PATTERN.test(trimmed)) return { fraction: Number.NaN, error: INVALID_APR_ERROR };
  return { fraction: aprPercentToFraction(Number(trimmed)) };
}

type DebtFormProps = {
  initial: FormValues;
  submitLabel: string;
  onSubmit: (input: {
    name: string;
    balanceCents: number;
    apr: number;
    minimumPaymentCents: number;
  }) => Promise<string | null>;
};

/** Shared form for adding and editing a debt. `onSubmit` resolves to an error message or null. */
function DebtForm({ initial, submitLabel, onSubmit }: DebtFormProps) {
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const setField = (field: keyof FormValues, errorKey: keyof FieldErrors) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [errorKey]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const balance = readMoneyField(values.balance, EMPTY_BALANCE_ERROR, INVALID_BALANCE_ERROR);
    const minimum = readMoneyField(values.minimum, EMPTY_MINIMUM_ERROR, INVALID_MINIMUM_ERROR);
    const apr = readAprField(values.apr);
    const validation = validateDebtInput({
      name: values.name,
      balanceCents: balance.cents,
      apr: apr.fraction,
      minimumPaymentCents: minimum.cents,
    });
    const found: FieldErrors = {};
    if (!validation.ok) {
      for (const error of validation.errors) {
        if (error.field === "name") found.name = error.message;
        else if (error.field === "balanceCents") found.balance = error.message;
        else if (error.field === "apr") found.apr = error.message;
        else if (error.field === "minimumPaymentCents") found.minimum = error.message;
        else found.form = error.message;
      }
    }
    if (balance.error) found.balance = balance.error;
    if (minimum.error) found.minimum = minimum.error;
    if (apr.error) found.apr = apr.error;
    if (!validation.ok || Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const message = await onSubmit(validation.value);
    setSubmitting(false);
    if (message !== null) setErrors({ form: message });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input
        label="Name"
        fill="raised"
        value={values.name}
        error={errors.name}
        onChange={(event) => setField("name", "name")(event.target.value)}
      />
      <Input
        label="Current balance"
        variant="money"
        fill="raised"
        value={values.balance}
        error={errors.balance}
        onChange={(event) => setField("balance", "balance")(event.target.value)}
      />
      <Input
        label="APR (%)"
        fill="raised"
        inputMode="decimal"
        value={values.apr}
        error={errors.apr}
        onChange={(event) => setField("apr", "apr")(event.target.value)}
      />
      <Input
        label="Minimum monthly payment"
        variant="money"
        fill="raised"
        value={values.minimum}
        error={errors.minimum}
        onChange={(event) => setField("minimum", "minimum")(event.target.value)}
      />
      {errors.form ? (
        <p role="alert" className="text-body text-blood">
          {errors.form}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" loading={submitting}>
        {submitLabel}
      </Button>
    </form>
  );
}

function AddDebtForm({ onClose }: { onClose: () => void }) {
  const { addDebt } = useCryptActions();
  const toast = useToast();
  return (
    <DebtForm
      initial={EMPTY_VALUES}
      submitLabel="Save debt"
      onSubmit={async (input) => {
        const result = await addDebt(input);
        if (!result.ok) {
          return result.error.kind === "validation"
            ? (result.error.errors[0]?.message ?? GENERIC_ERROR)
            : result.error.message;
        }
        onClose();
        toast.show({
          tone: "success",
          message: `Debt added: ${result.value.name}, ${formatCentsShort(result.value.balanceCents)}`,
        });
        return null;
      }}
    />
  );
}

type RowSheetProps = {
  row: DebtRow | null;
  onClose: () => void;
  onLogPayment: () => void;
  onDelete: () => void;
};

function RowSheet({ row, onClose, onLogPayment, onDelete }: RowSheetProps) {
  const { editDebt } = useCryptActions();
  const toast = useToast();
  const paidOff = row !== null && row.balanceCents === 0;

  return (
    <BottomSheet open={row !== null} onClose={onClose} title={row?.name ?? "Debt"}>
      {row ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-body text-ink-secondary">
              Balance {formatCentsShort(row.balanceCents)}. {formatDebtSubtitle(row)}
            </p>
            {paidOff ? (
              <div>
                <Chip tone="success" icon={CheckCircle2}>
                  Paid off
                </Chip>
              </div>
            ) : null}
            <Button type="button" variant="secondary" disabled={paidOff} onClick={onLogPayment}>
              Log payment
            </Button>
          </div>
          <h3 className="font-display text-title text-ink">Edit debt</h3>
          <DebtForm
            key={row.id}
            initial={toFormValues(row)}
            submitLabel="Save changes"
            onSubmit={async (input) => {
              const result = await editDebt(row.id, input);
              if (!result.ok) {
                return result.error.kind === "validation"
                  ? (result.error.errors[0]?.message ?? GENERIC_ERROR)
                  : result.error.message;
              }
              onClose();
              toast.show({ tone: "success", message: `Debt updated: ${result.value.name}` });
              return null;
            }}
          />
          <Button type="button" variant="danger" size="lg" onClick={onDelete}>
            {DELETE_LABEL}
          </Button>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function DebtsScreen() {
  const data = useCryptData();
  const { deleteDebt } = useCryptActions();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  // The deleted row is gone, so the element that opened the sheet no longer exists. Focus the
  // list heading once every sheet has closed and returned focus.
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [focusHeading, setFocusHeading] = useState(false);
  const sheetOpen = addOpen || rowId !== null || paymentId !== null || deleteTarget !== null;
  useEffect(() => {
    if (!focusHeading || sheetOpen) return;
    const timer = window.setTimeout(() => {
      document.getElementById(DEBTS_HEADING_ID)?.focus();
      setFocusHeading(false);
    }, FOCUS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [focusHeading, sheetOpen]);

  if (data.status === "loading") {
    return (
      <main className="flex flex-col" aria-busy="true">
        <PageHeader title={PAGE_TITLE} />
        <Skeleton lines={SKELETON_LINES} />
      </main>
    );
  }

  const debts = sortDebtsByBalance(data.rows.debts);
  const totalCents = debts.reduce((sum, row) => sum + row.balanceCents, 0);
  const selected = debts.find((row) => row.id === rowId) ?? null;

  return (
    <main className="flex flex-col gap-3">
      <PageHeader
        title={PAGE_TITLE}
        action={
          <Button type="button" variant="primary" leadingIcon={Plus} onClick={() => setAddOpen(true)}>
            {ADD_LABEL}
          </Button>
        }
      />
      <Card>
        <p className="text-label text-ink-secondary">Total debt</p>
        <p className="mt-1 font-display text-title text-ink tabular-nums">{formatCents(totalCents)}</p>
        <p className="mt-1 text-body text-ink-secondary">
          {debts.length} {debts.length === 1 ? "debt" : "debts"}
        </p>
      </Card>
      <Card title="Your debts" headingId={DEBTS_HEADING_ID}>
        {debts.length === 0 ? (
          <EmptyState icon={Landmark} title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} />
        ) : (
          <ul className="mt-2 flex flex-col">
            {debts.map((row) => (
              <li key={row.id}>
                <ListRow
                  icon={Landmark}
                  tone="blood"
                  title={row.name}
                  subtitle={formatDebtRowSubtitle(row)}
                  amount={formatCents(row.balanceCents)}
                  aria-label={`${row.name}, balance ${formatCentsShort(row.balanceCents)}, ${formatDebtRowSubtitle(row)}`}
                  onClick={() => setRowId(row.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={ADD_LABEL}>
        <AddDebtForm onClose={() => setAddOpen(false)} />
      </BottomSheet>
      <RowSheet
        row={paymentId === null && deleteTarget === null ? selected : null}
        onClose={() => setRowId(null)}
        onLogPayment={() => setPaymentId(rowId)}
        onDelete={() => {
          if (selected) setDeleteTarget({ id: selected.id, name: selected.name });
        }}
      />
      <DeleteConfirmSheet
        open={deleteTarget !== null}
        onClose={() => {
          setDeleteTarget(null);
          setRowId(null);
        }}
        name={deleteTarget?.name ?? ""}
        confirmLabel={DELETE_LABEL}
        onConfirm={async () => {
          if (deleteTarget === null) return { ok: true, value: undefined };
          const result = await deleteDebt(deleteTarget.id);
          if (result.ok) {
            toast.show({ tone: "success", message: DELETED_MESSAGE });
            setFocusHeading(true);
          }
          return result;
        }}
      />
      <LogPaymentSheet
        open={paymentId !== null}
        onClose={() => {
          setPaymentId(null);
          setRowId(null);
        }}
        debts={debts}
        initialDebtId={paymentId ?? undefined}
      />
    </main>
  );
}
