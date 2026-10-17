import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { NavIcon, type NavIconName } from "@/components/nav-icons";
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

const PROBLEMS = [
  {
    big: "Prepare 50. Get asked 2.",
    body: "And never learn whether any of your prep worked.",
  },
  {
    big: "No numbers.",
    body: "You don't know which figures interviewers want, or where to find them.",
  },
  {
    big: "No structure.",
    body: "Stories ramble because they were never built against a framework.",
  },
  {
    big: "No focus.",
    body: "It's hard to tell which parts of your history matter for this role.",
  },
];

const STEPS = [
  {
    title: "Add the job you're going for",
    body: "Paste the posting or a link. You'll see the questions they're most likely to ask, before you write a word.",
  },
  {
    title: "Build one story at a time",
    body: "Tell it your way, out loud or typed. Short questions pull out what you did, the stakes and the numbers, and you get a rough draft early.",
  },
  {
    title: "Practice and walk in ready",
    body: "Get feedback on each story, rehearse with follow-up questions, and read a one-page brief before the interview.",
  },
];

// The first feature is the large tile, with a crop of the dashboard.
const FEATURES: { icon: NavIconName; title: string; body: string }[] = [
  {
    icon: "grid",
    title: "Coverage at a glance",
    body: "See which of the ten question themes your stories cover and which one to build next.",
  },
  {
    icon: "book",
    title: "Story builder",
    body: "Guided questions turn a memory into a clear story with a situation, your actions and a result you can measure.",
  },
  {
    icon: "chat",
    title: "Likely questions",
    body: "Predicted from the job posting, your level and your past interviews, each matched to the story that answers it.",
  },
  {
    icon: "hash",
    title: "Your numbers",
    body: "A checklist of the figures your role is judged on, so every story has proof in it.",
  },
  {
    icon: "mic",
    title: "Practice mode",
    body: "Answer out loud, get feedback on what you said and how you said it, then take the follow-up.",
  },
  {
    icon: "briefcase",
    title: "Pre-interview brief",
    body: "Your best stories, the questions to expect and the questions to ask, on one page.",
  },
];

export default function WelcomePage() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Sticky, so Sign in stays one tap away however far down the page someone reads. */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="text-xl" aria-label="InterviewMax home">
            <Wordmark onDark />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink-900 shadow-sm transition hover:bg-accent-100"
          >
            Sign in
            <span aria-hidden>→</span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-ink-900 text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 sm:pt-16 sm:pb-24 lg:grid-cols-2">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                Behavioral interview stories that land.
              </h1>
              <p className="mt-4 max-w-xl text-lg text-ink-100">
                InterviewMax turns your work history into clear stories with real numbers, aimed
                at the jobs you&apos;re going for. One story at a time, so it never feels like
                homework.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="rounded-xl bg-accent-400 px-5 py-3 font-semibold text-ink-950 transition hover:bg-accent-300"
                >
                  Get started
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl px-5 py-3 font-semibold text-white ring-2 ring-white/70 transition hover:bg-white/10"
                >
                  Sign in
                </Link>
              </div>
            </div>
            <Screenshot
              src="/home/dashboard.webp"
              width={1600}
              height={1075}
              alt="The InterviewMax dashboard: a prep plan for an interview in 9 days, the story bank with 4 of 10 question themes covered, and the likely questions for the job."
              priority
            />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="problem">
          <h2 id="problem" className="max-w-3xl text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Most people know which questions are coming, and still walk in with rambling stories
            that have no numbers.
          </h2>
          <ul className="mt-8 grid overflow-hidden rounded-3xl bg-accent-950 text-white shadow-lg sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEMS.map((p) => (
              <li
                key={p.big}
                className="border-white/10 p-6 not-last:border-b sm:p-7 sm:odd:border-r lg:border-b-0 lg:not-last:border-r"
              >
                <p className="text-2xl font-extrabold tracking-tight text-accent-300 sm:text-3xl">
                  {p.big}
                </p>
                <p className="mt-2 text-ink-100">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white" aria-labelledby="showcase">
          <div className="mx-auto max-w-6xl space-y-16 px-4 py-16 sm:px-6 sm:space-y-24 sm:py-24">
            <h2 id="showcase" className="sr-only">
              What it looks like
            </h2>
            <Showcase
              eyebrow="Know what's coming"
              title="See the questions before you write a word"
              body="Paste a job posting and InterviewMax predicts the questions they're most likely to ask, then points each one at the story that answers it, or the one to build next."
              image={{
                src: "/home/likely-questions.webp",
                width: 1200,
                height: 1001,
                alt: "A target job page listing likely questions, each matched to a story that answers it.",
              }}
            />
            <Showcase
              eyebrow="Build it with help"
              title="Your story, with your numbers, in your words"
              body="Tell it your way, typed or out loud. A few short questions fill the gaps, and you get a clear story where every number comes from your own answers."
              image={{
                src: "/home/story.webp",
                width: 1200,
                height: 977,
                alt: "A finished story about winning over a skeptical finance VP, next to a criterion-by-criterion evaluation.",
              }}
              flip
            />
            <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <div>
                <p className="text-sm font-semibold text-accent-700">From rambling to ready</p>
                <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  The same story, before and after
                </h3>
                <p className="mt-3 text-lg text-slate-600">
                  Situation, what you did, and a result someone can remember. Short enough to say
                  in under two minutes.
                </p>
              </div>
              <BeforeAfter />
            </div>
          </div>
        </section>

        <section className="bg-accent-50" aria-labelledby="how">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 id="how" className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              How it works
            </h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-accent-200">
                  <span className="flex size-10 items-center justify-center rounded-full bg-accent-400 text-lg font-extrabold text-ink-950">
                    {i + 1}
                  </span>
                  <p className="mt-3 text-lg font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-slate-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="features">
          <h2 id="features" className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Everything you need for the behavioral round
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) =>
              i === 0 ? (
                <li
                  key={f.title}
                  className="flex flex-col overflow-hidden rounded-3xl bg-ink-800 text-white shadow-lg sm:col-span-2 lg:row-span-2"
                >
                  <div className="p-6 sm:p-7">
                    <FeatureIcon name={f.icon} onDark />
                    <p className="mt-4 text-xl font-bold">{f.title}</p>
                    <p className="mt-1 max-w-md text-ink-100">{f.body}</p>
                  </div>
                  <Image
                    src="/home/coverage.webp"
                    width={776}
                    height={322}
                    alt="Question themes covered: 6 of 10, with tiles for themes like Impact and results, Conflict and difficult people, and Ambiguity and change."
                    sizes="(min-width: 1024px) 740px, 100vw"
                    className="mt-auto h-auto w-full px-3 pb-3 sm:px-4 sm:pb-4"
                  />
                </li>
              ) : (
                <li key={f.title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                  <FeatureIcon name={f.icon} />
                  <p className="mt-4 font-semibold text-slate-900">{f.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{f.body}</p>
                </li>
              ),
            )}
          </ul>
        </section>

        <section className="bg-white" aria-labelledby="faq">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_2fr] lg:gap-14">
            <div>
              <h2 id="faq" className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Questions people ask
              </h2>
              <p className="mt-3 text-slate-600">
                Anything else? The{" "}
                <Link href="/privacy" className="font-semibold text-ink-800 underline">
                  privacy policy
                </Link>{" "}
                covers the details.
              </p>
            </div>
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-900 transition group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <div className="pb-5 text-slate-600">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-ink-900 text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Build your first story today.
            </h2>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href="/login"
                className="rounded-xl bg-accent-400 px-5 py-3 font-semibold text-ink-950 transition hover:bg-accent-300"
              >
                Get started
              </Link>
              <p className="text-ink-100">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-white underline underline-offset-4">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6">
        <span className="text-sm text-slate-500">© InterviewMax</span>
        <PolicyLinks />
      </footer>
    </div>
  );
}

function Screenshot({
  src,
  width,
  height,
  alt,
  priority = false,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  priority?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
      <div className="flex gap-1.5 border-b border-slate-200 bg-slate-100 px-4 py-2.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-slate-300" />
        <span className="size-2.5 rounded-full bg-slate-300" />
        <span className="size-2.5 rounded-full bg-slate-300" />
      </div>
      <Image
        src={src}
        width={width}
        height={height}
        alt={alt}
        priority={priority}
        sizes="(min-width: 1024px) 576px, 100vw"
        className="h-auto w-full"
      />
    </div>
  );
}

function Showcase({
  eyebrow,
  title,
  body,
  image,
  flip = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  image: { src: string; width: number; height: number; alt: string };
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className={flip ? "lg:order-2" : ""}>
        <p className="text-sm font-semibold text-accent-700">{eyebrow}</p>
        <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h3>
        <p className="mt-3 text-lg text-slate-600">{body}</p>
      </div>
      <Screenshot {...image} />
    </div>
  );
}

function FeatureIcon({ name, onDark = false }: { name: NavIconName; onDark?: boolean }) {
  return (
    <span
      className={`flex size-11 items-center justify-center rounded-xl ${
        onDark ? "bg-accent-400 text-ink-950" : "bg-accent-100 text-accent-800"
      }`}
    >
      <NavIcon name={name} />
    </span>
  );
}

const policyLink = "font-semibold text-ink-800 underline";

const FAQ: { q: string; a: ReactNode }[] = [
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
        You, and the founder, who is also the coach and can read your stories to give you
        feedback. Every story opened that way is logged, and uploads like your resume aren&apos;t
        shown. The{" "}
        <Link href="/privacy" className={policyLink}>
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
        No. We only use AI providers that don&apos;t train on what we send, and we don&apos;t
        train or fine-tune any model on your stories. The{" "}
        <Link href="/ai-usage" className={policyLink}>
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
