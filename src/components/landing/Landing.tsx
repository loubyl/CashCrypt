"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OnboardingSheet } from "@/components/sheets/OnboardingSheet";
import { Button } from "@/components/ui/Button";
import { useCrypt } from "@/hooks/useCrypt";
import { useDemo } from "@/hooks/useDemo";
import { useToast } from "@/components/ui/ToastRegion";

const HOME_PATH = "/";
const PITCH =
  "Your money habits haunt your house. Pay down the haunting, and the lights come back on.";
const DEMO_ERROR = "The demo crypt could not be opened. Check that your browser allows local storage.";

export function Landing() {
  const router = useRouter();
  const { hasRealProfile, setMode } = useCrypt();
  const { enterDemo } = useDemo();
  const { show } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [entering, setEntering] = useState(false);

  const handleDemo = async () => {
    setEntering(true);
    try {
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
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col justify-center gap-6 px-page py-10">
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
      <Link
        href="/styleguide"
        className="self-start rounded-md text-body-lg text-candle underline underline-offset-4 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        View the styleguide
      </Link>
      <OnboardingSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={handleCreated}
      />
    </main>
  );
}
