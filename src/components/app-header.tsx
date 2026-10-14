import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";

// The sections reached from every page. Stories live on the home page.
const NAV = [
  { href: "/jobs", label: "Target jobs", short: "Jobs" },
  { href: "/transcripts", label: "Past interviews", short: "Interviews" },
] as const;

export function AppHeader() {
  return (
    <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link href="/" className="text-lg font-extrabold tracking-tight text-navy-900">
            InterviewMax
          </Link>
          <nav aria-label="Sections" className="flex items-center gap-3 text-sm font-medium sm:gap-4">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-slate-600 hover:text-navy-800">
                <span className="sm:hidden">{item.short}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <Suspense fallback={<span className="h-5 w-32 animate-pulse rounded bg-slate-200" />}>
          <AccountMenu />
        </Suspense>
      </div>
    </header>
  );
}

async function AccountMenu() {
  const user = await getCurrentUser();
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden text-slate-600 sm:inline" data-testid="user-email">
        {user.email}
      </span>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="rounded-full px-3 py-1.5 font-medium text-navy-800 ring-1 ring-navy-800/20 hover:bg-navy-50"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
