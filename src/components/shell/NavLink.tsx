"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CreditCard,
  Flame,
  House,
  Repeat,
  Settings,
  type LucideIcon,
} from "lucide-react";

const ICON_SIZE_PX = 20;
const ICON_STROKE_WIDTH = 2;
const ROOT_PATH = "/";

export type NavDestination = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const HOME_DESTINATION: NavDestination = { href: "/", label: "Home", icon: House };
export const SETTINGS_DESTINATION: NavDestination = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
};

/** Destinations shown in the Tab_Bar. Settings lives in the page header below 1024px. */
export const TAB_DESTINATIONS: readonly NavDestination[] = [
  HOME_DESTINATION,
  { href: "/exorcism", label: "Exorcism", icon: Flame },
  { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/debts", label: "Debts", icon: CreditCard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
];

/** All six destinations, shown in the Sidebar. */
export const SIDEBAR_DESTINATIONS: readonly NavDestination[] = [
  ...TAB_DESTINATIONS,
  SETTINGS_DESTINATION,
];

/** `/` matches exactly; every other destination matches by path prefix. */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (pathname === null) return false;
  if (href === ROOT_PATH) return pathname === ROOT_PATH;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type NavLinkVariant = "tab" | "sidebar" | "icon";

export type NavLinkProps = {
  destination: NavDestination;
  variant: NavLinkVariant;
};

const BASE_CLASSES =
  "flex min-h-11 min-w-11 items-center justify-center rounded-pill font-sans " +
  "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const VARIANT_CLASSES: Record<NavLinkVariant, string> = {
  tab: "flex-1 flex-col gap-1 py-2 text-caption",
  sidebar: "w-full justify-start gap-3 px-4 text-body-lg",
  icon: "",
};

export function NavLink({ destination, variant }: NavLinkProps) {
  const pathname = usePathname();
  const active = isActivePath(pathname, destination.href);
  const Icon = destination.icon;
  const tone = active ? "text-candle font-semibold" : "text-ink-secondary";
  const activeSurface = active && variant === "sidebar" ? "bg-surface-raised" : "";
  const classes = [BASE_CLASSES, VARIANT_CLASSES[variant], tone, activeSurface]
    .filter(Boolean)
    .join(" ");

  return (
    <Link
      href={destination.href}
      aria-current={active ? "page" : undefined}
      aria-label={variant === "icon" ? destination.label : undefined}
      className={classes}
    >
      <Icon size={ICON_SIZE_PX} strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
      {variant === "icon" ? null : <span>{destination.label}</span>}
    </Link>
  );
}
