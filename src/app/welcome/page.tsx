import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { PolicyLinks } from "@/components/policy-links";
import { Wordmark } from "@/components/wordmark";
import { BeforeAfter } from "./before-after";

export const metadata: Metadata = {
  title: "InterviewMax · Behavioral interview stories that land",
  description:
    "Turn your work history into behavioral interview stories with real numbers, aimed at the jobs you're going for.",
};

// The public homepage. Signed-out visitors to / see this page at / (src/lib/supabase/proxy.ts);
// signed in, / is the dashboard.
//
// Built around one real question (design review 2026-11-23, fix 8): the question people dread, the
// way most people answer it, and the same story told on the talk track, then three plain steps and
// the questions people ask. No tiles, screenshots or feature grid.

const STEPS = [
  {
    title: "Add the job you're going for",
    body: "Paste the posting or a link. You see the questions they're most likely to ask before you write a word.",
  },
  {
    title: "Tell each story your way",
    body: "Type it or say it. A few short questions pull out the stakes, your part and the numbers, and you get a draft in your own words.",
  },
  {
    title: "Say it out loud",
    body: "Practice with the follow-ups an interviewer would ask, then take a one-page brief into the room.",
  },
];

export default function WelcomePage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="mx-auto flex w-full max-w-[78rem] items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" className="text-xl" aria-label="InterviewMax home">
          <Wordmark />
        </Link>
        <Link href="/login" className="text-sm font-medium text-slate-900 hover:underline">
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[78rem] flex-1 px-4 sm:px-6">
        <section className="grid gap-12 pt-8 pb-16 sm:pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:pb-20">
          <div>
            <p className="text-sm text-slate-600">Behavioral interviews ask things like</p>
            <h1 className="mt-4 font-words text-[2.5rem] leading-[1.08] font-semibold tracking-tight text-slate-900 sm:text-5xl">
              &ldquo;Tell me about a time you disagreed with your manager.&rdquo;
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-700">
              You have the experience. InterviewMax helps you turn it into a two-minute answer with
              the stakes, your decision and the number, built from your own words and ready for the
              follow-up questions.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/login" className="btn-next min-h-11 px-5 text-[0.9375rem]">
                Build your first story
              </Link>
              <Link href="#how" className="link">
                See how it works
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-600" data-testid="home-prep-only">
              Free while we&apos;re testing it. For preparing only: nothing runs during your real
              interview.
            </p>
          </div>
          <div className="lg:border-l lg:border-ink-200 lg:pl-12">
            <BeforeAfter />
          </div>
        </section>

        <section className="border-t border-ink-200 py-14" aria-labelledby="how">
          <h2 id="how" className="sr-only">
            How it works
          </h2>
          <ol className="grid gap-10 md:grid-cols-3 md:gap-12">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="font-mono text-sm text-slate-500">{i + 1}</span>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-slate-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="grid gap-8 border-t border-ink-200 py-14 lg:grid-cols-[1fr_2fr] lg:gap-16"
          aria-labelledby="faq"
        >
          <div>
            <h2 id="faq" className="text-2xl font-semibold tracking-tight text-slate-900">
              Questions people ask
            </h2>
            <p className="mt-3 text-slate-600">
              Anything else? The{" "}
              <Link href="/privacy" className="link">
                privacy policy
              </Link>{" "}
              covers the details.
            </p>
          </div>
          <dl className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="font-semibold text-slate-900">{item.q}</dt>
                <dd className="mt-1.5 text-slate-600">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-ink-200 py-12">
          <p className="font-words text-2xl text-slate-900">
            Start with the question you&apos;d least like to be asked.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/login" className="btn-next min-h-11 px-5 text-[0.9375rem]">
              Build your first story
            </Link>
            <p className="text-sm text-slate-600">
              Have an account?{" "}
              <Link href="/login" className="link">
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-[78rem] px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 py-6">
          <span className="text-sm text-slate-600">© InterviewMax</span>
          <PolicyLinks />
        </div>
      </footer>
    </div>
  );
}

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Does it help me during the interview?",
    a: "No, and on purpose. InterviewMax is for preparing only: it never listens in or feeds you answers in a real interview. Companies now disqualify candidates for using AI in the room, and a story you built yourself holds up under follow-ups anyway.",
  },
  {
    q: "How long does a story take?",
    a: "You get a rough draft early, once you've told it your way and answered a few short questions. You can stop at any point and come back to it later.",
  },
  {
    q: "What does it cost?",
    a: "Nothing. InterviewMax is free while we're testing it.",
  },
  {
    q: "Who can see my stories?",
    a: (
      <>
        You, and the founder, who is also the coach and can read your stories to give you feedback.
        Every story opened that way is logged, and uploads like your resume aren&apos;t shown. The{" "}
        <Link href="/privacy" className="link">
          privacy policy
        </Link>{" "}
        has the details.
      </>
    ),
  },
  {
    q: "Is my data used to train AI?",
    a: (
      <>
        No. We only use AI providers that don&apos;t train on what we send, and we don&apos;t train
        or fine-tune any model on your stories. The{" "}
        <Link href="/ai-usage" className="link">
          AI usage policy
        </Link>{" "}
        explains what is sent and why.
      </>
    ),
  },
  {
    q: "Can I delete everything?",
    a: "Yes. Delete any story, job or past interview from its page, or delete your account and everything in it in one step from Settings.",
  },
  {
    q: "Do I need a password?",
    a: "No. Enter your email and we'll send you a sign-in code, or continue with Google or LinkedIn.",
  },
];
