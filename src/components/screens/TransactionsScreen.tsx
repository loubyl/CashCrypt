"use client";
import { useEffect, useState } from "react";
import { Ghost, Plus, Receipt } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/common/Skeleton";
import { AddExpenseSheet } from "@/components/sheets/AddExpenseSheet";
import { DeleteConfirmSheet } from "@/components/sheets/DeleteConfirmSheet";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { useToast } from "@/components/ui/ToastRegion";
import { useCryptActions } from "@/hooks/useCryptActions";
import { useCryptData } from "@/hooks/useCryptData";
import { useNow } from "@/hooks/useNow";
import { formatMonthDay } from "@/lib/utils/calendar";
import { formatCents, formatCentsShort } from "@/lib/utils/cents";
import {
  getSmallExpenseSummary,
  getTransactionSubtitle,
  toTransactionRows,
  type TransactionListRow,
} from "@/lib/utils/listViews";

const PAGE_TITLE = "Transactions";
const ADD_LABEL = "Add expense";
const SKELETON_LINES = 4;
const SEPARATOR = " · ";
const NO_INCOME_CENTS = 0;
const POLTERGEIST_AWAKE = "The Poltergeist is awake.";
const EMPTY_TITLE = "No ghosts this month. The house is quiet.";
const EMPTY_DESCRIPTION = "Add an expense to see where small spending goes.";
const LIST_TITLE = "Last 30 days";
const LIST_HEADING_ID = "transactions-heading";
const DELETE_LABEL = "Delete expense";
const DELETED_MESSAGE = "Expense deleted";
const GHOST_NOTE = "A ghost: a small expense under the threshold.";
const FOCUS_DELAY_MS = 0;


type ExpenseSheetProps = {
  row: TransactionListRow | null;
  onClose: () => void;
  onDelete: () => void;
};

function ExpenseSheet({ row, onClose, onDelete }: ExpenseSheetProps) {
  return (
    <BottomSheet open={row !== null} onClose={onClose} title={row?.description ?? "Expense"}>
      {row ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="font-display text-title text-ink tabular-nums">{formatCentsShort(row.amountCents)}</p>
            <p className="text-body text-ink-secondary">
              {row.category}
              {SEPARATOR}
              {formatMonthDay(row.date)}
            </p>
            {row.isGhost ? <p className="text-body text-ink-secondary">{GHOST_NOTE}</p> : null}
          </div>
          {/* Destructive but secondary: text-only, like the Debt and Subscription sheets. */}
          <div className="mt-2 flex justify-center">
            <Button type="button" variant="danger-ghost" onClick={onDelete}>
              {DELETE_LABEL}
            </Button>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export function TransactionsScreen() {
  const data = useCryptData();
  const now = useNow();
  const { deleteTransaction } = useCryptActions();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  // The deleted row is gone, so the element that opened the sheet no longer exists. Focus the
  // list heading once every sheet has closed and returned focus.
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [focusHeading, setFocusHeading] = useState(false);
  const sheetOpen = addOpen || rowId !== null || deleteTarget !== null;
  useEffect(() => {
    if (!focusHeading || sheetOpen) return;
    const timer = window.setTimeout(() => {
      document.getElementById(LIST_HEADING_ID)?.focus();
      setFocusHeading(false);
    }, FOCUS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [focusHeading, sheetOpen]);

  if (data.status === "loading" || now === null) {
    return (
      <main className="flex flex-col" aria-busy="true">
        <PageHeader title={PAGE_TITLE} />
        <Skeleton lines={SKELETON_LINES} />
      </main>
    );
  }
  const { transactions, profile } = data.rows;
  const income = profile?.monthlyIncomeCents ?? NO_INCOME_CENTS;
  const rows = toTransactionRows(transactions, now, income);
  const summary = getSmallExpenseSummary(transactions, now, income);
  const selected = rows.find((row) => row.id === rowId) ?? null;
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
        <p className="text-label text-ink-secondary">Small expenses, last 30 days</p>
        <p className="mt-1 font-display text-title text-ink tabular-nums">
          {formatCents(summary.totalCents)}
        </p>
        <p className="mt-1 text-body text-ink-secondary tabular-nums">
          Poltergeist threshold: {formatCents(summary.thresholdCents)}
        </p>
        {summary.awake ? (
          <p className="mt-2 text-body text-spirit">{POLTERGEIST_AWAKE}</p>
        ) : null}
      </Card>
      <Card title={LIST_TITLE} headingId={LIST_HEADING_ID}>
        {rows.length === 0 ? (
          <EmptyState icon={Ghost} title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} />
        ) : (
          <ul className="mt-2 flex flex-col">
            {rows.map((row) => (
              <li key={row.id}>
                {/* The ghost icon marks a small expense; the accessible name says "ghost" too. */}
                <ListRow
                  icon={row.isGhost ? Ghost : Receipt}
                  tone={row.isGhost ? "ghost" : "neutral"}
                  title={row.description}
                  subtitle={getTransactionSubtitle(row)}
                  amount={formatCents(row.amountCents)}
                  amountDirection="out"
                  aria-label={`${row.description}, ${row.category}, ${formatMonthDay(row.date)}, spent ${formatCentsShort(row.amountCents)}${row.isGhost ? ", ghost" : ""}`}
                  onClick={() => setRowId(row.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <AddExpenseSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <ExpenseSheet
        row={deleteTarget === null ? selected : null}
        onClose={() => setRowId(null)}
        onDelete={() => {
          if (selected) setDeleteTarget({ id: selected.id, name: selected.description });
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
          const result = await deleteTransaction(deleteTarget.id);
          if (result.ok) {
            toast.show({ tone: "success", message: DELETED_MESSAGE });
            setFocusHeading(true);
          }
          return result;
        }}
      />
    </main>
  );
}
