"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Flame, Plus, Wallet } from "lucide-react";
import { Skeleton } from "@/components/common/Skeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { HouseScene } from "@/components/house/HouseScene";
import { CryptGuide, useGuideVisibility } from "@/components/dashboard/CryptGuide";
import { DemoControls } from "@/components/demo/DemoControls";
import { ExorcismPlan, EXORCISM_PLAN_HEADING_ID } from "@/components/exorcism/ExorcismPlan";
import { AddExpenseSheet } from "@/components/sheets/AddExpenseSheet";
import { LogPaymentSheet } from "@/components/sheets/LogPaymentSheet";
import { BalanceHero } from "@/components/ui/BalanceHero";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LightScoreBar } from "@/components/ui/LightScoreBar";
import { QuickAction } from "@/components/ui/QuickAction";
import { useCrypt } from "@/hooks/useCrypt";
import { useExorcismPlan } from "@/hooks/useExorcismPlan";
import { useHouseState } from "@/hooks/useHouseState";
import { useSceneModel } from "@/hooks/useSceneModel";
import { getGuideStep } from "@/lib/utils/planView";
import { getLevelAnnouncement, getNextLevelText, getScoreDelta } from "@/lib/utils/scoreView";
import { MomentHost } from "@/components/moments/MomentHost";
import type { MomentHostLive } from "@/components/moments/MomentHost";
import type { MomentRequest } from "@/lib/moments/types";
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
// minmax(0, …) tracks: a bare `7fr 5fr` track has an automatic minimum (its min-content), so the
// column widths followed the plan text and the 4:3 Scene grew or shrank whenever a plan row changed
// (ticking an action resized the Scene by about 48px and shifted the page). `grid-cols-2` already
// uses minmax(0, 1fr).
const GRID_CLASSES =
  "flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]";
const HOW_IT_WORKS_LABEL = "How it works";
const HOW_IT_WORKS_ID = "dashboard-how-it-works";
const GUIDE_HEADING_ID = "dashboard-guide-heading";
// Grid placement (design D9): the Guide is first in the DOM and sits at the top of the right column
// from 1024px. The placement classes apply only while the Guide is shown, so a hidden Guide leaves
// no empty grid row and the first viewport stays as it was.
const GUIDE_PLACEMENT_CLASSES = "lg:col-start-2 lg:row-start-1";
const LEFT_COLUMN_GUIDE_CLASSES = "lg:col-start-1 lg:row-start-1 lg:row-span-2";
const RIGHT_COLUMN_GUIDE_CLASSES = "lg:col-start-2 lg:row-start-2";
const DELTA_SIGN_PATTERN = /^[+−]/;

export function Dashboard() {
  const router = useRouter();
  const result = useHouseState();
  const scene = useSceneModel();
  const { plan } = useExorcismPlan();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const { status } = useCrypt();
  const guide = useGuideVisibility(status === "demo" ? "demo" : "real");
  const pendingFocus = useRef<"button" | "heading" | null>(null);
  const [bannerPulseKey, setBannerPulseKey] = useState(0);
  const handlePlanned = useCallback((requests: readonly MomentRequest[]) => {
    if (requests.some((request) => request.kind === "poltergeistFeed")) {
      setBannerPulseKey((key) => key + 1);
    }
  }, []);

  const guideShown = guide.shown;
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    const id = target === "button" ? HOW_IT_WORKS_ID : GUIDE_HEADING_ID;
    document.getElementById(id)?.focus();
  }, [guideShown]);
  const handleDismissGuide = useCallback(() => {
    pendingFocus.current = "button";
    guide.dismiss();
  }, [guide]);
  const handleOpenGuide = useCallback(() => {
    pendingFocus.current = "heading";
    guide.open();
  }, [guide]);

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
    ghostTransactionIds: houseState.ghosts.map((ghost) => ghost.transactionId),
    subscriptionNames: Object.fromEntries(rows.subscriptions.map((sub) => [sub.id, sub.name])),
    planActions: (plan?.actions ?? []).map((action) => ({
      id: action.id,
      kind: action.kind,
      done: action.done,
    })),
  };

  return (
    <main className="flex flex-col gap-3">
      <PageHeader
        title={PAGE_TITLE}
        action={
          guideShown ? undefined : (
            <Button id={HOW_IT_WORKS_ID} variant="ghost" size="md" onClick={handleOpenGuide}>
              {HOW_IT_WORKS_LABEL}
            </Button>
          )
        }
      />
      <p className="sr-only" aria-live="polite" role="status">
        {getLevelAnnouncement(houseState.decayLevel, houseState.lightScore)}
      </p>
      <MomentHost live={live} onPlanned={handlePlanned}>
        {({ model, held, onRelease }) => (
          <>
          <div className={GRID_CLASSES}>
            {guideShown ? (
              <CryptGuide
                mode={status === "demo" ? "demo" : "real"}
                step={status === "demo" && plan ? getGuideStep(plan.actions, rows) : null}
                onDismiss={handleDismissGuide}
                headingId={GUIDE_HEADING_ID}
                className={GUIDE_PLACEMENT_CLASSES}
              />
            ) : null}
            <div className={guideShown ? `${COLUMN_CLASSES} ${LEFT_COLUMN_GUIDE_CLASSES}` : COLUMN_CLASSES}>
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
            <div className={guideShown ? `${COLUMN_CLASSES} ${RIGHT_COLUMN_GUIDE_CLASSES}` : COLUMN_CLASSES}>
              {houseState.poltergeist ? (
                <PoltergeistBanner smallExpenseTotalCents={houseState.poltergeist.totalAmount} pulseKey={bannerPulseKey} />
              ) : null}
              <Card
                title={PLAN_CARD_TITLE}
                headingLevel="h2"
                headingId={EXORCISM_PLAN_HEADING_ID}
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
