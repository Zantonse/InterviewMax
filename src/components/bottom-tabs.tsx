"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon, type NavIconName } from "./nav-icons";

export type BottomTab = { href: string; label: string; icon: NavIconName; exact?: boolean };

// Where each mode's phone tabs go. Build a story sits in the middle (design comparison
// 2026-11-17, pattern 3: Duolingo/Headspace/Speak put the main action at thumb reach). Library,
// Settings and the mode switch stay in the Menu drawer.
export const INTERVIEW_TABS: readonly BottomTab[] = [
  { href: "/", label: "Prep", icon: "home", exact: true },
  { href: "/jobs", label: "Jobs", icon: "briefcase" },
  { href: "/practice", label: "Practice", icon: "mic" },
  { href: "/profile", label: "Profile", icon: "user" },
];

export const PROMOTION_TABS: readonly BottomTab[] = [
  { href: "/promotion", label: "Promotion", icon: "stairs", exact: true },
  { href: "/promotion/packet", label: "Packet", icon: "doc" },
  { href: "/numbers", label: "Numbers", icon: "chart" },
  { href: "/profile", label: "Profile", icon: "user" },
];

export function isTabActive(tab: BottomTab, pathname: string): boolean {
  if (tab.exact) return pathname === tab.href;
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

// Phones only: the four places you go most, with Build a story in the middle.
export function BottomTabs({ tabs }: { tabs: readonly BottomTab[] }) {
  const pathname = usePathname() ?? "";
  const [a, b, c, d] = tabs;
  const building = pathname === "/stories/new";
  return (
    <nav
      id="app-tabs"
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
      data-testid="bottom-tabs"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
        {[a, b].map((tab) => (
          <TabLink key={tab.href} tab={tab} active={isTabActive(tab, pathname)} />
        ))}
        <li className="flex justify-center">
          <Link
            href="/stories/new"
            aria-current={building ? "page" : undefined}
            className="-mt-4 flex flex-col items-center gap-0.5 pb-1.5 text-xs font-semibold text-ink-900"
            data-testid="tab-build"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-400 text-ink-950 shadow-md ring-4 ring-white">
              <NavIcon name="plus" />
            </span>
            Build
          </Link>
        </li>
        {[c, d].map((tab) => (
          <TabLink key={tab.href} tab={tab} active={isTabActive(tab, pathname)} />
        ))}
      </ul>
    </nav>
  );
}

function TabLink({ tab, active }: { tab: BottomTab; active: boolean }) {
  return (
    <li>
      <Link
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-14 flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-xs font-medium ${
          active ? "text-ink-900" : "text-slate-600 hover:text-ink-900"
        }`}
      >
        <span className={active ? "text-accent-700" : ""}>
          <NavIcon name={tab.icon} />
        </span>
        {tab.label}
      </Link>
    </li>
  );
}
