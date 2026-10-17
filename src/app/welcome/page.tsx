import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PolicyLinks } from "@/components/policy-links";
import { Wordmark } from "@/components/wordmark";

export const metadata: Metadata = {
  title: "InterviewMax · Behavioral interview stories that land",
  description:
    "Turn your work history into behavioral interview stories with real numbers, aimed at the jobs you're going for.",
};

// The public homepage. Signed-out visitors to / see this page at / (src/lib/supabase/proxy.ts);
// signed in, / is the dashboard.

const PROBLEMS = [
  {
    title: "No numbers at hand",
    body: "You don't know which figures interviewers want, or where to find them.",
  },
  {
    title: "No structure",
    body: "Stories ramble because they were never built against a framework or refined.",
  },
  {
    title: "Unclear emphasis",
    body: "It's hard to tell which parts of your history matter most for this role.",
  },
  {
    title: "Prep that doesn't pay off",
    body: "Prepare 50 answers, get asked 2, and never learn whether any of it worked.",
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

const FEATURES = [
  {
    title: "Story builder",
    body: "Guided questions turn a memory into a clear story with a situation, your actions and a result you can measure.",
  },
  {
    title: "Likely questions",
    body: "Predicted from the job posting, your level and your past interviews, each matched to the story that answers it.",
  },
  {
    title: "Coverage at a glance",
    body: "See which of the ten question themes your stories cover and which one to build next.",
  },
  {
    title: "Your numbers",
    body: "A checklist of the figures your role is judged on, so every story has proof in it.",
  },
  {
    title: "Practice mode",
    body: "Answer out loud, get feedback on what you said and how you said it, then take the follow-up.",
  },
  {
    title: "Pre-interview brief",
    body: "Your best stories, the questions to expect and the questions to ask, on one page.",
  },
];

export default function WelcomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-ink-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="text-xl" aria-label="InterviewMax home">
            <Wordmark onDark />
          </Link>
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10"
          >
            Sign in
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
                  className="rounded-xl px-5 py-3 font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/10"
                >
                  I have an account
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
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEMS.map((p) => (
              <li key={p.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <p className="font-semibold text-slate-900">{p.title}</p>
                <p className="mt-1 text-sm text-slate-600">{p.body}</p>
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

        <section aria-labelledby="how">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="how" className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              How it works
            </h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <span className="flex size-9 items-center justify-center rounded-full bg-accent-100 font-bold text-accent-900">
                    {i + 1}
                  </span>
                  <p className="mt-3 text-lg font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-slate-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="features">
          <h2 id="features" className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Everything you need for the behavioral round
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <p className="font-semibold text-slate-900">{f.title}</p>
                <p className="mt-1 text-sm text-slate-600">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-labelledby="yours">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <h2 id="yours" className="text-xl font-extrabold tracking-tight text-slate-900">
              Your stories stay yours
            </h2>
            <p className="mt-2 max-w-3xl text-slate-700">
              Every story is built from your own answers and your own numbers. You can delete your
              account and everything in it in one step, and our{" "}
              <Link href="/ai-usage" className="font-semibold text-ink-800 underline">
                AI usage policy
              </Link>{" "}
              explains exactly what is sent to AI models and why.
            </p>
          </div>
        </section>

        <section className="bg-ink-900 text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Build your first story today.
            </h2>
            <Link
              href="/login"
              className="rounded-xl bg-accent-400 px-5 py-3 font-semibold text-ink-950 transition hover:bg-accent-300"
            >
              Get started
            </Link>
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

// The promise in one picture: a rambling answer next to the story InterviewMax helps build.
function BeforeAfter() {
  return (
    <div className="space-y-3" aria-label="An example answer before and after InterviewMax">
      <figure className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
        <figcaption className="text-xs font-semibold text-slate-500">Before</figcaption>
        <blockquote className="mt-2 text-slate-600 italic">
          &ldquo;So, there was this onboarding project, and it was kind of a mess, and I helped
          out a lot with fixing things, and in the end it went pretty well, customers liked
          it&hellip;&rdquo;
        </blockquote>
      </figure>
      <figure className="rounded-2xl bg-ink-900 p-5 text-white shadow-lg">
        <figcaption className="text-xs font-semibold text-accent-300">After</figcaption>
        <blockquote className="mt-2 space-y-2 text-[15px] leading-relaxed">
          <p>
            <span className="font-semibold">Situation.</span> 40 enterprise accounts were taking
            9 weeks to go live, and two were threatening to churn.
          </p>
          <p>
            <span className="font-semibold">What I did.</span> I mapped every handoff, cut the
            setup steps from 14 to 6 and ran weekly check-ins with each account.
          </p>
          <p>
            <span className="font-semibold">Result.</span> Go-live dropped to 3 weeks and both
            accounts renewed.
          </p>
        </blockquote>
      </figure>
    </div>
  );
}
