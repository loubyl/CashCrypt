"use client";

import { NavLink, TAB_DESTINATIONS } from "@/components/shell/NavLink";

/** Fixed bottom navigation, used below 1024px. */
export function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 bg-surface-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-content items-stretch px-2">
        {TAB_DESTINATIONS.map((destination) => (
          <li key={destination.href} className="flex flex-1">
            <NavLink destination={destination} variant="tab" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
