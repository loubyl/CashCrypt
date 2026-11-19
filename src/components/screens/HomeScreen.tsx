"use client";

import { Skeleton } from "@/components/common/Skeleton";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { Landing } from "@/components/landing/Landing";
import { useCrypt } from "@/hooks/useCrypt";

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
