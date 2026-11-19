import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import {
  COACH_NEVER_SEES,
  COACH_SEES,
  INVITE_PROBLEMS,
  isInviteCode,
  type InviteStatus,
} from "@/lib/coaching/invite-code";
import { getMyCoaching, inviteStatus } from "@/lib/coaching/relationship";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = {
  title: "Coaching invite · InterviewMax",
  robots: { index: false, follow: false },
};

// The consent screen for a 1:1 coaching invite (2026-11-19): says exactly what the coach will see
// and won't, before the person says yes. Signed out, the proxy keeps the code through sign-in and
// brings them back here.
export default function CoachInvitePage({ params }: PageProps<"/coach/[code]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-3xl bg-white/80" />}>
          <InviteContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function InviteContent({ params }: { params: PageProps<"/coach/[code]">["params"] }) {
  const { code } = await params;
  let status: InviteStatus = "invalid";
  let alreadyOn = false;
  if (isInviteCode(code)) {
    try {
      const [s, mine] = await Promise.all([inviteStatus(code), getMyCoaching()]);
      status = s;
      alreadyOn = s === "ok" && Boolean(mine);
    } catch (err) {
      unstable_rethrow(err);
      console.error("Coaching: checking an invite failed", err);
      return (
        <Panel title="Coaching isn't open yet">
          <p className="mt-3 text-slate-600">
            This invite can&apos;t be checked right now. Try the link again later, or tell your
            coach.
          </p>
        </Panel>
      );
    }
  }

  if (status !== "ok") {
    return (
      <Panel title="This invite can't be used">
        <p className="mt-3 text-slate-600" data-testid="invite-problem">
          {INVITE_PROBLEMS[status]}
        </p>
        <Link href="/" className="mt-6 inline-block font-medium text-ink-800 hover:underline">
          Go to your prep
        </Link>
      </Panel>
    );
  }

  if (alreadyOn) {
    return (
      <Panel title="You're already being coached">
        <p className="mt-3 text-slate-600">
          Your coach can already see your prep. You can stop coaching from Settings at any time.
        </p>
        <Link
          href="/settings#coaching"
          className="mt-6 inline-block font-medium text-ink-800 hover:underline"
        >
          Open Settings
        </Link>
      </Panel>
    );
  }

  return (
    <Panel title="Your coach invited you to 1:1 coaching">
      <p className="mt-3 text-slate-600">
        Craig, the founder of InterviewMax, coaches you one to one, and to do that needs to see your
        prep. Here&apos;s exactly what that means.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-ink-50 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-900">Your coach sees</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-800" data-testid="coach-sees">
            {COACH_SEES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Never shown</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-800">
            {COACH_NEVER_SEES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">
        Every time your coach opens your page or one of your stories, it&apos;s logged. You can
        stop coaching from Settings at any time, and your coach&apos;s page for you closes at once.
        Nothing you&apos;ve made is changed or deleted. See the{" "}
        <Link href="/privacy" className="font-medium text-ink-800 hover:underline">
          privacy policy
        </Link>
        .
      </p>
      <AcceptForm code={code} />
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="animate-enter rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
      {children}
    </section>
  );
}
