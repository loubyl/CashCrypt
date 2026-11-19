"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Flame, Plus, Wallet } from "lucide-react";
import { Skeleton } from "@/components/common/Skeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoControls } from "@/components/demo/DemoControls";
import { ExorcismPlan } from "@/components/exorcism/ExorcismPlan";
import { AddExpenseSheet } from "@/components/sheets/AddExpenseSheet";
import { LogPaymentSheet } from "@/components/sheets/LogPaymentSheet";
import { BalanceHero } from "@/components/ui/BalanceHero";
import { Card } from "@/components/ui/Card";
import { LightScoreBar } from "@/components/ui/LightScoreBar";
import { QuickAction } from "@/components/ui/QuickAction";
import { useExorcismPlan } from "@/hooks/useExorcismPlan";
import { useHouseState } from "@/hooks/useHouseState";
import { getLevelAnnouncement, getNextLevelText, getScoreDelta } from "@/lib/utils/scoreView";
import { PoltergeistBanner } from "./PoltergeistBanner";
import { ScenePlaceholder } from "./ScenePlaceholder";

const PAGE_TITLE = "Your crypt";
const SCORE_LABEL = "Light score";
const SCORE_BAR_LABEL = "Light score";
const PLAN_CARD_TITLE = "This week's exorcism";
const PLAN_CARD_ACTION_LABEL = "See all";
const EXORCISM_PATH = "/exorcism";
const SKELETON_LINES = 4;
const DELTA_SIGN_PATTERN = /^[+−]/;

export function Dashboard() {
  const router = useRouter();
  const result = useHouseState();
  const { plan } = useExorcismPlan();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  if (result.status !== "ready") {
    return (
      <main className="flex flex-col" aria-busy="true">
        <PageHeader title={PAGE_TITLE} />
        <Skeleton lines={SKELETON_LINES} />
      </main>
    );
  }

  const { houseState, rows } = result;
  const payableDebts = rows.debts.filter((debt) => debt.balanceCents > 0);
  const scoreDelta = plan ? getScoreDelta(houseState.lightScore, plan.startLightScore) : null;
  const heroDelta = scoreDelta
    ? {
        direction: scoreDelta.direction,
        intent: scoreDelta.intent,
        amount: scoreDelta.text.replace(DELTA_SIGN_PATTERN, ""),
      }
    : undefined;

  return (
    <main className="flex flex-col gap-3">
      <PageHeader title={PAGE_TITLE} />
      <p className="sr-only" aria-live="polite" role="status">
        {getLevelAnnouncement(houseState.decayLevel, houseState.lightScore)}
      </p>
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
        <ScenePlaceholder level={houseState.decayLevel} className="lg:col-span-2" />
        {houseState.poltergeist ? (
          <PoltergeistBanner
            smallExpenseTotalCents={houseState.poltergeist.totalAmount}
            className="lg:col-span-2"
          />
        ) : null}
        <Card>
          <BalanceHero
            label={SCORE_LABEL}
            format="score"
            showMax
            value={houseState.lightScore}
            delta={heroDelta}
          />
          <LightScoreBar
            aria-label={SCORE_BAR_LABEL}
            score={houseState.lightScore}
            baseScore={houseState.baseScore}
            momentum={houseState.momentum}
            // The BalanceHero above already shows the score, so the bar shows the next level instead.
            caption={getNextLevelText(houseState.decayLevel, houseState.lightScore)}
            className="mt-4"
          />
          <div className="mt-6 grid grid-cols-4 gap-2">
            <QuickAction
              icon={Wallet}
              label="Log payment"
              disabled={payableDebts.length === 0}
              onClick={() => setPaymentOpen(true)}
            />
            <QuickAction icon={Plus} label="Add expense" onClick={() => setExpenseOpen(true)} />
            <QuickAction icon={FileUp} label="Import CSV" disabled />
            <QuickAction icon={Flame} label="Exorcise" onClick={() => router.push(EXORCISM_PATH)} />
          </div>
        </Card>
        <Card
          title={PLAN_CARD_TITLE}
          headingLevel="h2"
          action={{ label: PLAN_CARD_ACTION_LABEL, href: EXORCISM_PATH }}
        >
          <ExorcismPlan variant="card" />
        </Card>
        <DemoControls />
      </div>
      <LogPaymentSheet open={paymentOpen} onClose={() => setPaymentOpen(false)} debts={payableDebts} />
      <AddExpenseSheet open={expenseOpen} onClose={() => setExpenseOpen(false)} />
    </main>
  );
}
