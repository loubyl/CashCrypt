"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { startGuideSession } from "@/components/dashboard/CryptGuide";
import { HouseScene } from "@/components/house/HouseScene";
import { OnboardingSheet } from "@/components/sheets/OnboardingSheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastRegion";
import { useCrypt } from "@/hooks/useCrypt";
import { useDemo } from "@/hooks/useDemo";
import { buildLandingPreview } from "@/lib/demo/preview";

const HOME_PATH = "/";
const PITCH =
  "Your money habits haunt your house. Pay down the haunting, and the lights come back on.";
const DEMO_ERROR = "The demo crypt could not be opened. Check that your browser allows local storage.";
const HOW_HEADING_ID = "landing-how";
const HOW_IT_WORKS_LINES = [
  "Debt darkens the house. Paying it down brings the light back.",
  "Subscriptions become zombies, and small expenses become ghosts that can merge into a Poltergeist.",
  "Every week, a three-step exorcism plan tells you what to do next.",
] as const;

export function Landing() {
  const router = useRouter();
  const { hasRealProfile, setMode } = useCrypt();
  const { enterDemo } = useDemo();
  const { show } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [entering, setEntering] = useState(false);
  const preview = buildLandingPreview();

  const handleDemo = async () => {
    setEntering(true);
    try {
      startGuideSession();
      await enterDemo();
      router.replace(HOME_PATH);
    } catch {
      show({ message: DEMO_ERROR, tone: "danger" });
    } finally {
      setEntering(false);
    }
  };

  const handleContinue = () => {
    setMode("real");
    router.replace(HOME_PATH);
  };

  const handleCreated = () => {
    setSheetOpen(false);
    router.replace(HOME_PATH);
  };

  return (
    <main className="mx-auto grid w-full max-w-content flex-1 content-center gap-6 px-page py-10 lg:max-w-5xl lg:grid-cols-[5fr_7fr] lg:items-center">
      <div className="flex flex-col gap-6">
        <h1 className="font-wordmark text-display font-medium text-ink">CashCrypt</h1>
        <p className="text-body-lg text-ink-secondary">{PITCH}</p>
        <div className="flex flex-col gap-3">
          <Button variant="primary" size="lg" loading={entering} onClick={handleDemo}>
            Enter the demo crypt
          </Button>
          {hasRealProfile ? (
            <Button variant="secondary" size="lg" onClick={handleContinue}>
              Continue to my crypt
            </Button>
          ) : (
            <Button variant="secondary" size="lg" onClick={() => setSheetOpen(true)}>
              Start my own crypt
            </Button>
          )}
        </div>
      </div>
      <HouseScene model={preview} ambient={false} className="lg:col-start-2 lg:row-span-2 lg:row-start-1" />
      <section aria-labelledby={HOW_HEADING_ID} className="flex flex-col gap-3">
        <h2 id={HOW_HEADING_ID} className="text-label text-ink-secondary">
          How it works
        </h2>
        <ul className="flex flex-col gap-2 text-body text-ink">
          {HOW_IT_WORKS_LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <OnboardingSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={handleCreated}
      />
    </main>
  );
}
