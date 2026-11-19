"use client";

import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/common/Skeleton";
import { ExorcismPlan } from "@/components/exorcism/ExorcismPlan";
import { Card } from "@/components/ui/Card";
import { useExorcismPlan } from "@/hooks/useExorcismPlan";
import { formatCentsShort } from "@/lib/utils/cents";
import { formatWeekRange } from "@/lib/utils/calendar";
import { summarizePlan } from "@/lib/utils/planView";

const PAGE_TITLE = "Exorcism";
const FREED_LABEL = "Money freed this week";
const PER_MONTH_SUFFIX = "/mo";
const EXPLANATION = "Tap Do it to make the change here, or tick an action you did somewhere else.";
const COMPLETE_MESSAGE = "Exorcism complete. The lights flicker back on.";
const SKELETON_LINES = 4;

export function ExorcismScreen() {
  const { status, plan, weekKey } = useExorcismPlan();

  if (status === "loading" || plan === null || weekKey === null) {
    return (
      <main className="flex flex-col" aria-busy="true">
        <PageHeader title={PAGE_TITLE} />
        <Skeleton lines={SKELETON_LINES} />
      </main>
    );
  }

  const summary = summarizePlan(plan.actions);

  return (
    <main className="flex flex-col gap-3">
      <PageHeader
        title={PAGE_TITLE}
        description={`${formatWeekRange(weekKey)} · ${summary.doneCount} of ${summary.total} done`}
      />
      <Card>
        <ExorcismPlan variant="page" />
        <p className="mt-4 text-caption text-ink-secondary">{EXPLANATION}</p>
      </Card>
      <Card>
        <p className="text-label text-ink-secondary">{FREED_LABEL}</p>
        <p className="mt-1 font-display text-title text-ink tabular-nums">
          {formatCentsShort(summary.freedCents)}
          {PER_MONTH_SUFFIX}
        </p>
        <p className="mt-1 text-body text-ink-secondary tabular-nums">
          of {formatCentsShort(summary.possibleCents)}
          {PER_MONTH_SUFFIX} possible
        </p>
      </Card>
      <p className="text-body-lg text-ink" role="status" aria-live="polite">
        {summary.allDone ? COMPLETE_MESSAGE : ""}
      </p>
    </main>
  );
}
