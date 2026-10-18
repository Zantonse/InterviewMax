import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { startStory } from "@/app/stories/new/actions";
import { levelLabel } from "@/lib/jobs/content";
import {
  MAX_LADDER_LENGTH,
  gapMap,
  isGap,
  levelStep,
  redactionLines,
  type DimensionEvidence,
  type EvidenceStatus,
} from "@/lib/promotion/content";
import { getPromotionPlan, requirePromotion } from "@/lib/promotion/data";
import { levelMix, needLabel } from "@/lib/stories/bank";
import { listStories } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";
import { clearLadder } from "./actions";
import { BetaBadge } from "./beta-badge";
import { LadderForm, LevelsForm, RedactionsForm } from "./forms";

export const metadata: Metadata = { title: "Your promotion · PromotionMax" };

// Reading a pasted ladder is a model call.
export const maxDuration = 120;

export default function PromotionPage() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <PromotionHome />
        </Suspense>
      </main>
    </div>
  );
}

const STATUS: Record<EvidenceStatus, { label: string; className: string }> = {
  at_target: { label: "At target level", className: "bg-green-100 text-green-900" },
  current_only: { label: "Story at current level only", className: "bg-amber-100 text-amber-900" },
  not_graded: { label: "Not graded yet", className: "bg-slate-100 text-slate-700" },
  in_progress: { label: "Story in progress", className: "bg-slate-100 text-slate-700" },
  empty: { label: "No story yet", className: "bg-red-50 text-red-800" },
};

async function PromotionHome() {
  await requirePromotion();
  const [plan, stories] = await Promise.all([getPromotionPlan(), listStories()]);
  const evidence = gapMap(stories, plan);
  const gaps = evidence.filter(isGap).length;
  const step = levelStep(plan);
  const missing = plan.targetLevel
    ? levelMix(stories, plan.targetLevel).needs.filter((n) => n.have < n.needed)
    : [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Your promotion
        </h1>
        <BetaBadge />
      </div>
      <p className="mt-2 max-w-2xl text-slate-600">
        Build the case for your next level from the same stories, aimed at your manager and the
        promotion committee instead of an interviewer.
        {step && (
          <>
            {" "}
            <strong className="text-slate-900" data-testid="level-step">
              {step}
            </strong>
          </>
        )}
      </p>

      <Section title="1 · The level you're going for">
        <LevelsForm current={plan.currentLevel} target={plan.targetLevel} />
      </Section>

      <Section
        title="2 · Evidence gap map"
        aside={
          plan.targetLevel ? (
            <span className="text-sm text-slate-500" data-testid="gap-count">
              {gaps === 0
                ? "No gaps"
                : `${gaps} of ${evidence.length} need a story at ${levelLabel(plan.targetLevel)}`}
            </span>
          ) : null
        }
      >
        <p className="text-sm text-slate-600">
          {plan.ladder
            ? `Your ladder's dimensions${plan.ladder.readAt ? `, read ${shortDate(plan.ladder.readAt)}` : ""}.`
            : "What promotion committees usually weigh. Paste your company's ladder below to use its dimensions instead."}{" "}
          A story counts at the target level once its grade shows it at the scope that level needs.
        </p>
        {!plan.targetLevel && (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Pick the level you&apos;re going for to see which stories already hold up there.
          </p>
        )}
        <form action={startStory}>
          <ul className="mt-4 space-y-3" data-testid="gap-map">
            {evidence.map((e) => (
              <DimensionRow key={e.dimension.id} evidence={e} />
            ))}
          </ul>
        </form>
        {missing.length > 0 && plan.targetLevel && (
          <div
            className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm"
            data-testid="promotion-level-mix"
          >
            <p className="font-semibold text-slate-900">
              Across your stories, for {levelLabel(plan.targetLevel)}
            </p>
            <ul className="mt-1 space-y-0.5 text-slate-700">
              {missing.map((need) => (
                <li key={need.role}>
                  {needLabel(need)[0].toUpperCase() + needLabel(need).slice(1)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="3 · Your promotion packet">
        <p className="text-sm text-slate-600">
          A self-review draft, a short summary for your manager and talking points, written only
          from your stories. Every figure is checked against the story it came from.
        </p>
        <Link
          href="/promotion/packet"
          className="mt-3 inline-block rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-900"
          data-testid="packet-link"
        >
          {plan.packet ? "Open your packet →" : "Build your packet →"}
        </Link>
      </Section>

      <Section title="Your career ladder (optional)">
        <p className="text-sm text-slate-600">
          Paste the expectations for your level and the next. Its dimensions replace the generic
          ones above, each with the ladder&apos;s own words for what{" "}
          {plan.targetLevel ? levelLabel(plan.targetLevel) : "the target level"} needs.
        </p>
        <LadderForm initial={plan.ladder?.text ?? ""} maxLength={MAX_LADDER_LENGTH} />
        {plan.ladder && (
          <form action={clearLadder} className="mt-2">
            <button type="submit" className="text-sm font-semibold text-ink-800 hover:underline">
              Use the generic dimensions instead
            </button>
          </form>
        )}
      </Section>

      <Section title="Privacy">
        <p className="text-sm text-slate-600">
          Promotion stories are about where you work now. Stories you start in PromotionMax are
          hidden from your coach unless you share one from its page. Names you list here are swapped
          for their stand-in before anything goes to an AI model, in every step of the app. One per
          line, <code>Name = stand-in</code>; leave out the stand-in for &ldquo;a customer&rdquo;. A
          stand-in can&apos;t hold a number.
        </p>
        <RedactionsForm initial={redactionLines(plan.redactions)} />
      </Section>
    </>
  );
}

function DimensionRow({ evidence: e }: { evidence: DimensionEvidence }) {
  const status = STATUS[e.status];
  const build = getStoryType(e.build);
  return (
    <li
      className="rounded-2xl px-4 py-3 ring-1 ring-slate-200"
      data-testid={`dimension-${e.dimension.id}`}
      data-status={e.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{e.dimension.label}</p>
          {e.dimension.expects && (
            <p className="mt-0.5 text-sm text-slate-600">{e.dimension.expects}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
        >
          {status.label}
        </span>
      </div>
      {e.stories.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {e.stories.slice(0, 4).map((s) => (
            <li key={s.id}>
              <Link
                href={`/stories/${s.id}`}
                className="inline-block rounded-lg bg-slate-50 px-2.5 py-1 text-sm text-ink-800 ring-1 ring-slate-200 hover:bg-slate-100"
                title={STATUS[s.status].label}
              >
                {s.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {isGap(e) && build && (
        <button
          type="submit"
          name="storyType"
          value={build.id}
          className="mt-2 text-sm font-semibold text-ink-800 hover:underline"
          data-testid={`build-${e.dimension.id}`}
        >
          + Build {e.status === "empty" ? "a" : "a bigger"} story: {build.label}
        </button>
      )}
    </li>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {aside}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
