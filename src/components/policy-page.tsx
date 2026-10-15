import Link from "next/link";
import type { ReactNode } from "react";
import { POLICY_UPDATED } from "@/lib/privacy/contact";

// The frame for the policy pages and the account-deleted page. They open without signing in, so
// they use a plain top bar instead of the app's sidebar.
export function PolicyPage({
  title,
  dated = true,
  children,
}: {
  title: string;
  dated?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-ink-950/20 bg-ink-900 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-white">
          Interview<span className="text-accent-400">Max</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
        {dated && <p className="mt-2 text-sm text-slate-500">Last updated {POLICY_UPDATED}</p>}
        <div className="policy mt-8 space-y-8 text-slate-700">{children}</div>
        <nav className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-200 pt-6 text-sm">
          <Link href="/privacy" className="font-medium text-ink-800 hover:underline">
            Privacy policy
          </Link>
          <Link href="/ai-usage" className="font-medium text-ink-800 hover:underline">
            AI usage policy
          </Link>
          <Link href="/settings" className="font-medium text-ink-800 hover:underline">
            Your data and settings
          </Link>
        </nav>
      </main>
    </div>
  );
}

export function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

export function PolicyList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

export function ContactLine({ email }: { email: string | null }) {
  return email ? (
    <a href={`mailto:${email}`} className="font-medium text-ink-800 hover:underline">
      {email}
    </a>
  ) : (
    <>the person who invited you to try InterviewMax</>
  );
}
