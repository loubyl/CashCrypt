"use client";
import { Flame } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { Skeleton } from "@/components/common/Skeleton";
import { ExorcismPlan } from "@/components/exorcism/ExorcismPlan";
import { Card } from "@/components/ui/Card";
import { useExorcismPlan } from "@/hooks/useExorcismPlan";
import { useHouseState } from "@/hooks/useHouseState";
import { formatCentsShort } from "@/lib/utils/cents";
import { formatWeekRange } from "@/lib/utils/calendar";
import { summarizePlan } from "@/lib/utils/planView";
import { formatWeekResult } from "@/lib/utils/scoreView";

const PAGE_TITLE = "Exorcism";
const FREED_LABEL = "Money freed this week";
const PER_MONTH_SUFFIX = "/mo";
const EXPLANATION = "Tap Do it to make the change here, or tick an action you did somewhere else.";
const COMPLETE_MESSAGE = "Exorcism complete. The lights flicker back on.";
const SKELETON_LINES = 4;
const ICON_SIZE_PX = 22;
const ICON_STROKE_WIDTH = 2;

export function ExorcismScreen() {
  const { status, plan, weekKey } = useExorcismPlan();
  const house = useHouseState();

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
        {/* The hint only helps while something is left to do. */}
        {summary.allDone ? null : <p className="mt-4 text-caption text-ink-secondary">{EXPLANATION}</p>}
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
      {/* The live region is always in the DOM, so the Card is announced politely when it appears. */}
      <div role="status" aria-live="polite">
        {summary.allDone ? (
          <Card>
            <div className="flex items-start gap-3">
              <Flame
                size={ICON_SIZE_PX}
                strokeWidth={ICON_STROKE_WIDTH}
                className="mt-0.5 shrink-0 text-candle"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-1">
                <p className="text-body-lg text-ink">{COMPLETE_MESSAGE}</p>
                {house.status === "ready" ? (
                  <p className="text-body text-ink-secondary tabular-nums">
                    {formatWeekResult(plan.startLightScore, house.houseState.lightScore, house.houseState.decayLevel)}
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
