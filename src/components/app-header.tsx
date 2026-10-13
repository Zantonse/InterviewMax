import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";

export function AppHeader() {
  return (
    <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-navy-900">
          InterviewMax
        </Link>
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
