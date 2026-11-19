"use client";

import { useState, type FormEvent } from "react";
import { Flame, Hourglass, Plus, Skull, Ghost, Repeat, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/common/Skeleton";
import { CancelSubscriptionSheet } from "@/components/sheets/CancelSubscriptionSheet";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, type ChipAccentTone } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/ToastRegion";
import { useCryptActions } from "@/hooks/useCryptActions";
import { useCryptData } from "@/hooks/useCryptData";
import { normalizeSubscription } from "@/lib/haunting";
import { formatMonthDay } from "@/lib/utils/calendar";
import { formatCents, formatCentsShort, parseMoneyToCents } from "@/lib/utils/cents";
import { sortSubscriptionsByMonthlyCost } from "@/lib/utils/listViews";
import { validateSubscriptionInput } from "@/lib/validation/inputs";
import type { Cadence, SubscriptionRow, Usage } from "@/types/finance";

const PAGE_TITLE = "Subscriptions";
const SKELETON_LINES = 4;
const PER_MONTH_SUFFIX = "/mo";
const SEPARATOR = " · ";
const ADD_LABEL = "Add subscription";
const EMPTY_ACTIVE_TITLE = "No zombies in the basement. Suspiciously quiet.";
const EMPTY_ACTIVE_DESCRIPTION = "Add a subscription to see what is draining you each month.";
const EMPTY_GRAVEYARD_TITLE = "No tombstones yet. Suspiciously quiet.";
const EMPTY_GRAVEYARD_DESCRIPTION = "Canceled subscriptions rest here.";
const EMPTY_AMOUNT_ERROR = "Enter the amount.";
const INVALID_AMOUNT_ERROR = "Enter a valid amount.";
const GENERIC_ERROR = "Could not save the subscription. Try again.";
const USAGE_ERROR = "Could not update the usage. Try again.";
const REACTIVATE_ERROR = "Could not bring it back. Try again.";
const DEFAULT_CADENCE: Cadence = "monthly";
const DEFAULT_USAGE: Usage = "often";

const CADENCE_LABELS: Record<Cadence, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};
const USAGE_LABELS: Record<Usage, string> = {
  often: "Often used",
  rarely: "Rarely used",
  never: "Never used",
};
const USAGE_ICONS: Record<Usage, LucideIcon> = {
  often: Flame,
  rarely: Hourglass,
  never: Skull,
};
const USAGE_TONES: Record<Usage, ChipAccentTone> = {
  often: "success",
  rarely: "warning",
  never: "danger",
};
const CADENCE_OPTIONS: readonly SegmentedControlOption[] = (
  Object.keys(CADENCE_LABELS) as Cadence[]
).map((value) => ({ value, label: CADENCE_LABELS[value] }));
const USAGE_OPTIONS: readonly SegmentedControlOption[] = (
  Object.keys(USAGE_LABELS) as Usage[]
).map((value) => ({ value, label: USAGE_LABELS[value] }));

type FieldErrors = { name?: string; amount?: string; form?: string };

function toCadence(value: string): Cadence {
  return value === "weekly" || value === "yearly" ? value : DEFAULT_CADENCE;
}

function toUsage(value: string): Usage {
  return value === "rarely" || value === "never" ? value : DEFAULT_USAGE;
}

function getMonthlyCents(row: SubscriptionRow): number {
  return normalizeSubscription({
    subscriptionId: row.id,
    name: row.name,
    amountCents: row.amountCents,
    cadence: row.cadence,
    usage: row.usage,
    active: row.active,
  }).monthlyCostCents;
}

function UsageChip({ usage }: { usage: Usage }) {
  return (
    <Chip tone={USAGE_TONES[usage]} icon={USAGE_ICONS[usage]}>
      {USAGE_LABELS[usage]}
    </Chip>
  );
}

function AddSubscriptionForm({ onClose }: { onClose: () => void }) {
  const { addSubscription } = useCryptActions();
  const toast = useToast();
  const [name, setName] = useState("");
  const [amountText, setAmountText] = useState("");
  const [cadence, setCadence] = useState<Cadence>(DEFAULT_CADENCE);
  const [usage, setUsage] = useState<Usage>(DEFAULT_USAGE);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const cents = parseMoneyToCents(amountText);
    const validation = validateSubscriptionInput({
      name,
      amountCents: cents ?? Number.NaN,
      cadence,
      usage,
      active: true,
    });
    const found: FieldErrors = {};
    if (!validation.ok) {
      for (const error of validation.errors) {
        if (error.field === "name") found.name = error.message;
        else if (error.field === "amountCents") found.amount = error.message;
        else found.form = error.message;
      }
    }
    if (amountText.trim() === "") found.amount = EMPTY_AMOUNT_ERROR;
    else if (cents === null) found.amount = INVALID_AMOUNT_ERROR;
    if (!validation.ok || found.amount) {
      setErrors(found);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const result = await addSubscription(validation.value);
    setSubmitting(false);
    if (!result.ok) {
      const message =
        result.error.kind === "validation"
          ? (result.error.errors[0]?.message ?? GENERIC_ERROR)
          : result.error.message;
      setErrors({ form: message });
      return;
    }
    onClose();
    const monthly = getMonthlyCents(result.value);
    toast.show({
      tone: "success",
      message: `Zombie added: ${result.value.name}, ${formatCentsShort(monthly)}${PER_MONTH_SUFFIX}`,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input
        label="Name"
        fill="raised"
        value={name}
        error={errors.name}
        onChange={(event) => {
          setName(event.target.value);
          setErrors((current) => ({ ...current, name: undefined }));
        }}
      />
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
      <SegmentedControl
        aria-label="Billing cadence"
        options={CADENCE_OPTIONS}
        value={cadence}
        onChange={(value) => setCadence(toCadence(value))}
      />
      <SegmentedControl
        aria-label="How often you use it"
        options={USAGE_OPTIONS}
        value={usage}
        onChange={(value) => setUsage(toUsage(value))}
      />
      {errors.form ? (
        <p role="alert" className="text-body text-blood">
          {errors.form}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" loading={submitting}>
        Save subscription
      </Button>
    </form>
  );
}

type DetailsSheetProps = {
  row: SubscriptionRow | null;
  onClose: () => void;
  onCancel: () => void;
};

function DetailsSheet({ row, onClose, onCancel }: DetailsSheetProps) {
  const { editSubscription } = useCryptActions();
  const toast = useToast();
  const [failed, setFailed] = useState(false);

  const changeUsage = async (value: string) => {
    if (!row) return;
    setFailed(false);
    const result = await editSubscription(row.id, {
      name: row.name,
      amountCents: row.amountCents,
      cadence: row.cadence,
      usage: toUsage(value),
      active: row.active,
    });
    if (!result.ok) {
      setFailed(true);
      toast.show({ tone: "danger", message: USAGE_ERROR });
    }
  };

  return (
    <BottomSheet open={row !== null} onClose={onClose} title={row?.name ?? "Subscription"}>
      {row ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-body text-ink-secondary">
              {CADENCE_LABELS[row.cadence]} · {formatCentsShort(row.amountCents)} per{" "}
              {row.cadence === "weekly" ? "week" : row.cadence === "yearly" ? "year" : "month"}
            </p>
            <p className="font-display text-title text-ink tabular-nums">
              {formatCentsShort(getMonthlyCents(row))}
              {PER_MONTH_SUFFIX}
            </p>
          </div>
          <SegmentedControl
            aria-label="How often you use it"
            options={USAGE_OPTIONS}
            value={row.usage}
            onChange={changeUsage}
          />
          {failed ? (
            <p role="alert" className="text-body text-blood">
              {USAGE_ERROR}
            </p>
          ) : null}
          {/* Canceling a zombie is the good action, so it is the primary pill. */}
          <Button type="button" variant="primary" size="lg" onClick={onCancel}>
            Cancel subscription
          </Button>
        </div>
      ) : null}
    </BottomSheet>
  );
}

type GraveyardSheetProps = {
  row: SubscriptionRow | null;
  onClose: () => void;
};

function GraveyardSheet({ row, onClose }: GraveyardSheetProps) {
  const { reactivateSubscription } = useCryptActions();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleBringBack = async () => {
    if (!row || submitting) return;
    setSubmitting(true);
    setFailed(false);
    const result = await reactivateSubscription(row.id);
    setSubmitting(false);
    if (!result.ok) {
      setFailed(true);
      toast.show({ tone: "danger", message: REACTIVATE_ERROR });
      return;
    }
    toast.show({
      tone: "info",
      message: `${row.name} is back: ${formatCentsShort(getMonthlyCents(row))}${PER_MONTH_SUFFIX} returns`,
    });
    onClose();
  };

  return (
    <BottomSheet open={row !== null} onClose={onClose} title={row?.name ?? "Tombstone"}>
      {row ? (
        <div className="flex flex-col gap-4">
          <p className="text-body text-ink-secondary">
            R.I.P. {formatCentsShort(getMonthlyCents(row))}
            {PER_MONTH_SUFFIX}
            {row.canceledOn ? `${SEPARATOR}Canceled ${formatMonthDay(row.canceledOn)}` : ""}
          </p>
          {failed ? (
            <p role="alert" className="text-body text-blood">
              {REACTIVATE_ERROR}
            </p>
          ) : null}
          <Button type="button" variant="primary" size="lg" loading={submitting} onClick={handleBringBack}>
            Bring it back
          </Button>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function SubscriptionsScreen() {
  const data = useCryptData();
  const [addOpen, setAddOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [graveId, setGraveId] = useState<string | null>(null);

  if (data.status === "loading") {
    return (
      <main className="flex flex-col" aria-busy="true">
        <PageHeader title={PAGE_TITLE} />
        <Skeleton lines={SKELETON_LINES} />
      </main>
    );
  }

  const { subscriptions } = data.rows;
  const active = sortSubscriptionsByMonthlyCost(subscriptions.filter((row) => row.active));
  const graveyard = subscriptions
    .filter((row) => !row.active)
    .sort((a, b) => (b.canceledOn ?? "").localeCompare(a.canceledOn ?? "") || a.id.localeCompare(b.id));
  const totalCents = active.reduce((sum, row) => sum + getMonthlyCents(row), 0);
  const detailsRow = active.find((row) => row.id === detailsId) ?? null;
  const cancelRow = active.find((row) => row.id === cancelId) ?? null;
  const graveRow = graveyard.find((row) => row.id === graveId) ?? null;

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
        <p className="text-label text-ink-secondary">Total monthly cost</p>
        <p className="mt-1 font-display text-title text-ink tabular-nums">
          {formatCents(totalCents)}
          {PER_MONTH_SUFFIX}
        </p>
        <p className="mt-1 text-body text-ink-secondary">
          {active.length} active {active.length === 1 ? "subscription" : "subscriptions"}
        </p>
      </Card>
      <Card title="Zombies">
        {active.length === 0 ? (
          <EmptyState
            icon={Ghost}
            title={EMPTY_ACTIVE_TITLE}
            description={EMPTY_ACTIVE_DESCRIPTION}
          />
        ) : (
          <ul className="mt-2 flex flex-col">
            {active.map((row) => (
              <li key={row.id}>
                <ListRow
                  icon={Repeat}
                  tone="neutral"
                  title={row.name}
                  subtitle={`${CADENCE_LABELS[row.cadence]}${SEPARATOR}${USAGE_LABELS[row.usage]}`}
                  amount={formatCents(getMonthlyCents(row))}
                  aria-label={`${row.name}, ${USAGE_LABELS[row.usage]}, ${formatCentsShort(getMonthlyCents(row))} per month`}
                  onClick={() => setDetailsId(row.id)}
                />
                <div className="-mt-1 mb-2 pl-[52px]">
                  <UsageChip usage={row.usage} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Graveyard">
        {graveyard.length === 0 ? (
          <EmptyState
            icon={Skull}
            title={EMPTY_GRAVEYARD_TITLE}
            description={EMPTY_GRAVEYARD_DESCRIPTION}
          />
        ) : (
          <ul className="mt-2 flex flex-col">
            {graveyard.map((row) => (
              <li key={row.id}>
                <ListRow
                  icon={Skull}
                  tone="neutral"
                  title={row.name}
                  subtitle={`R.I.P. ${formatCentsShort(getMonthlyCents(row))}${PER_MONTH_SUFFIX}${
                    row.canceledOn ? `${SEPARATOR}Canceled ${formatMonthDay(row.canceledOn)}` : ""
                  }`}
                  onClick={() => setGraveId(row.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={ADD_LABEL}>
        <AddSubscriptionForm onClose={() => setAddOpen(false)} />
      </BottomSheet>
      <DetailsSheet
        row={cancelId === null ? detailsRow : null}
        onClose={() => setDetailsId(null)}
        onCancel={() => setCancelId(detailsId)}
      />
      <CancelSubscriptionSheet
        open={cancelRow !== null}
        onClose={() => {
          setCancelId(null);
          setDetailsId(null);
        }}
        subscriptionId={cancelRow?.id ?? ""}
        name={cancelRow?.name ?? ""}
        monthlyCents={cancelRow ? getMonthlyCents(cancelRow) : 0}
      />
      <GraveyardSheet row={graveRow} onClose={() => setGraveId(null)} />
    </main>
  );
}

