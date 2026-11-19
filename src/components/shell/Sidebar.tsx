"use client";

import { DemoChip } from "@/components/shell/DemoChip";
import { NavLink, SIDEBAR_DESTINATIONS } from "@/components/shell/NavLink";

/** Side navigation, used from 1024px. */
export function Sidebar() {
  return (
    <div className="sticky top-0 flex h-screen w-64 shrink-0 flex-col gap-6 bg-surface-card px-4 py-6">
      <p className="px-4 font-wordmark text-title font-medium text-ink">CashCrypt</p>
      <DemoChip />
      <nav aria-label="Main">
        <ul className="flex flex-col gap-1">
          {SIDEBAR_DESTINATIONS.map((destination) => (
            <li key={destination.href}>
              <NavLink destination={destination} variant="sidebar" />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
