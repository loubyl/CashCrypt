"use client";

import { useState } from "react";
import { Ghost, Plus, Receipt } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/common/Skeleton";
import { AddExpenseSheet } from "@/components/sheets/AddExpenseSheet";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ListRow } from "@/components/ui/ListRow";
import { useCryptData } from "@/hooks/useCryptData";
import { useNow } from "@/hooks/useNow";
import { formatMonthDay } from "@/lib/utils/calendar";
import { formatCents, formatCentsShort } from "@/lib/utils/cents";
import { getSmallExpenseSummary, toTransactionRows } from "@/lib/utils/listViews";

const PAGE_TITLE = "Transactions";
const ADD_LABEL = "Add expense";
const SKELETON_LINES = 4;
const SEPARATOR = " · ";
const NO_INCOME_CENTS = 0;
const GHOST_LABEL = "Ghost";
const POLTERGEIST_AWAKE = "The Poltergeist is awake.";
const EMPTY_TITLE = "No ghosts this month. The house is quiet.";
const EMPTY_DESCRIPTION = "Add an expense to see where small spending goes.";

export function TransactionsScreen() {
  const data = useCryptData();
  const now = useNow();
  const [addOpen, setAddOpen] = useState(false);

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
      <Card title="Last 30 days">
        {rows.length === 0 ? (
          <EmptyState icon={Ghost} title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} />
        ) : (
          <ul className="mt-2 flex flex-col">
            {rows.map((row) => (
              <li key={row.id}>
                <ListRow
                  icon={row.isGhost ? Ghost : Receipt}
                  tone={row.isGhost ? "ghost" : "neutral"}
                  title={row.description}
                  subtitle={`${row.category}${SEPARATOR}${formatMonthDay(row.date)}`}
                  badge={
                    row.isGhost ? (
                      <Chip tone="info" icon={Ghost}>
                        {GHOST_LABEL}
                      </Chip>
                    ) : undefined
                  }
                  amount={formatCents(row.amountCents)}
                  amountDirection="out"
                  aria-label={`${row.description}, ${row.category}, ${formatMonthDay(row.date)}, spent ${formatCentsShort(row.amountCents)}${row.isGhost ? ", ghost" : ""}`}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <AddExpenseSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </main>
  );
}
