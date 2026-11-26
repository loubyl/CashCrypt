"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Skeleton } from "@/components/common/Skeleton";
import { StorageBlockedCard } from "@/components/common/StorageBlockedCard";
import { DemoChip } from "@/components/shell/DemoChip";
import { SkipLink } from "@/components/shell/SkipLink";
import { NavLink, SETTINGS_DESTINATION } from "@/components/shell/NavLink";
import { Sidebar } from "@/components/shell/Sidebar";
import { TabBar } from "@/components/shell/TabBar";
import { useCrypt } from "@/hooks/useCrypt";

const DESKTOP_QUERY = "(min-width: 1024px)";
const ROOT_PATH = "/";

// Space for the fixed Tab_Bar (64px) plus the device safe area. The Sidebar needs none.
const CONTENT_CLASSES =
  "mx-auto grid w-full max-w-content grid-cols-1 content-start gap-gap px-page pt-4 " +
  "pb-[calc(4rem+env(safe-area-inset-bottom))] " +
  "lg:max-w-5xl lg:grid-cols-2 lg:pt-6 lg:pb-6 lg:[&>main]:col-span-2";

function subscribeDesktop(listener: () => void): () => void {
  const list = window.matchMedia(DESKTOP_QUERY);
  list.addEventListener("change", listener);
  return () => list.removeEventListener("change", listener);
}

function getDesktopSnapshot(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getServerDesktopSnapshot(): boolean {
  return false;
}

function LoadingScreen() {
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-page py-6">
      <h1 className="sr-only">Loading CashCrypt</h1>
      <Skeleton lines={4} />
    </main>
  );
}

function BlockedScreen() {
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-page py-6">
      <h1 className="sr-only">CashCrypt</h1>
      <StorageBlockedCard />
    </main>
  );
}

export type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const { status } = useCrypt();
  const pathname = usePathname();
  const router = useRouter();
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getServerDesktopSnapshot,
  );

  const isRoot = pathname === ROOT_PATH;
  const redirecting = status === "none" && !isRoot;

  useEffect(() => {
    if (redirecting) router.replace(ROOT_PATH);
  }, [redirecting, router]);

  // The skip link comes first in every branch, so it is the first focusable element.
  if (status === "loading" || redirecting) {
    return (
      <>
        <SkipLink />
        <LoadingScreen />
      </>
    );
  }
  if (status === "unavailable") {
    return (
      <>
        <SkipLink />
        <BlockedScreen />
      </>
    );
  }
  if (status === "none") {
    return (
      <>
        <SkipLink />
        {children}
      </>
    );
  }

  const content = <div className={CONTENT_CLASSES}>{children}</div>;

  if (isDesktop) {
    return (
      <div className="flex min-h-screen flex-1">
        <SkipLink />
        <Sidebar />
        <div className="min-w-0 flex-1">{content}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <SkipLink />
      <header className="mx-auto flex w-full max-w-content items-center justify-between gap-3 px-page pt-3">
        <div className="flex min-w-0 items-center gap-3">
          <p className="font-wordmark text-title font-medium text-ink">CashCrypt</p>
          <DemoChip />
        </div>
        <div className="shrink-0">
          <NavLink destination={SETTINGS_DESTINATION} variant="icon" />
        </div>
      </header>
      {content}
      <TabBar />
    </div>
  );
}
