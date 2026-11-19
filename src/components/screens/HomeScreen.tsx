"use client";

import { Skeleton } from "@/components/common/Skeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { Landing } from "@/components/landing/Landing";
import { BalanceHero } from "@/components/ui/BalanceHero";
import { useCrypt } from "@/hooks/useCrypt";
import { useHouseState } from "@/hooks/useHouseState";

/** Minimal Dashboard stub. The full Dashboard replaces it in a later task. */
function Dashboard() {
  const result = useHouseState();
  return (
    <main className="flex flex-col">
      <PageHeader title="Your crypt" />
      {result.status === "ready" ? (
        <BalanceHero label="Light score" format="score" showMax value={result.houseState.lightScore} />
      ) : (
        <Skeleton lines={2} />
      )}
    </main>
  );
}

export function HomeScreen() {
  const { status } = useCrypt();

  if (status === "loading") {
    return (
      <main className="mx-auto w-full max-w-content flex-1 px-page py-6">
        <h1 className="sr-only">Loading CashCrypt</h1>
        <Skeleton lines={4} />
      </main>
    );
  }
  if (status === "demo" || status === "real") return <Dashboard />;
  return <Landing />;
}
