"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Flame, Plus, Wallet } from "lucide-react";
import { Skeleton } from "@/components/common/Skeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { HouseScene } from "@/components/house/HouseScene";
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
import { useSceneModel } from "@/hooks/useSceneModel";
import { getLevelAnnouncement, getNextLevelText, getScoreDelta } from "@/lib/utils/scoreView";
import { MomentHost } from "@/components/moments/MomentHost";
import type { MomentHostLive } from "@/components/moments/MomentHost";
import { PoltergeistBanner } from "./PoltergeistBanner";

const PAGE_TITLE = "Your crypt";
const SCORE_LABEL = "Light score";
const SCORE_BAR_LABEL = "Light score";
const PLAN_CARD_TITLE = "This week's exorcism";
const PLAN_CARD_ACTION_LABEL = "See all";
const EXORCISM_PATH = "/exorcism";
const SKELETON_LINES = 4;
const SCENE_ASPECT_RATIO = "4 / 3";
const COLUMN_CLASSES = "contents lg:flex lg:flex-col lg:gap-3";
const DELTA_SIGN_PATTERN = /^[+−]/;

export function Dashboard() {
  const router = useRouter();
  const result = useHouseState();
  const scene = useSceneModel();
  const { plan } = useExorcismPlan();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  if (result.status !== "ready" || scene.status !== "ready") {
    return (
      <main className="flex flex-col gap-3" aria-busy="true">
        <PageHeader title={PAGE_TITLE} />
        <div
          aria-busy="true"
          data-part="scene-skeleton"
          className="w-full rounded-lg bg-linear-to-r from-surface-raised via-surface-card to-surface-raised bg-size-[200%_100%] animate-shimmer"
          style={{ aspectRatio: SCENE_ASPECT_RATIO }}
        />
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

  const live: MomentHostLive = {
    model: scene.model,
    liveKey: houseState,
    subscriptionNames: Object.fromEntries(rows.subscriptions.map((sub) => [sub.id, sub.name])),
    planActions: (plan?.actions ?? []).map((action) => ({
      id: action.id,
      kind: action.kind,
      done: action.done,
    })),
  };

  return (
    <main className="flex flex-col gap-3">
      <PageHeader title={PAGE_TITLE} />
      <p className="sr-only" aria-live="polite" role="status">
        {getLevelAnnouncement(houseState.decayLevel, houseState.lightScore)}
      </p>
      <MomentHost live={live}>
        {({ model, held, onRelease }) => (
          <>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start xl:grid-cols-[7fr_5fr]">
            <div className={COLUMN_CLASSES}>
              <HouseScene model={model} held={held} onRelease={onRelease} />
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
            </div>
            <div className={COLUMN_CLASSES}>
              {houseState.poltergeist ? (
                <PoltergeistBanner smallExpenseTotalCents={houseState.poltergeist.totalAmount} />
              ) : null}
              <Card
                title={PLAN_CARD_TITLE}
                headingLevel="h2"
                action={{ label: PLAN_CARD_ACTION_LABEL, href: EXORCISM_PATH }}
              >
                <ExorcismPlan variant="card" />
              </Card>
              <DemoControls />
            </div>
          </div>
          <LogPaymentSheet open={paymentOpen} onClose={() => setPaymentOpen(false)} debts={payableDebts} />
          <AddExpenseSheet open={expenseOpen} onClose={() => setExpenseOpen(false)} />
          </>
        )}
      </MomentHost>
    </main>
  );
}
