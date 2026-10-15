"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { WarmUpCard } from "@/lib/brief/brief";

const MINUTE = 60;

// The warm-up's cards, one at a time, with a gentle one-minute clock. Arrow keys or the buttons
// move between cards; the clock is a guide, not a limit.
export function WarmUp({
  cards,
  company,
  exitHref,
}: {
  cards: WarmUpCard[];
  company: string;
  exitHref: string;
}) {
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const done = index >= cards.length;

  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [done]);

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, cards.length)), [cards.length]);
  const back = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back]);

  const progress = Math.min(seconds / MINUTE, 1);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col" data-testid="warm-up">
      <div className="flex items-center justify-between gap-3 text-sm text-ink-200">
        <span className="font-semibold uppercase tracking-wide">Warm-up for {company}</span>
        <Link
          href={exitHref}
          className="rounded-lg px-2 py-1 font-medium hover:bg-white/10 hover:text-white"
        >
          Close
        </Link>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div
            className="h-full rounded-full bg-accent-400 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="w-12 text-right font-mono text-sm text-ink-200" aria-label="Time spent">
          {formatClock(seconds)}
        </span>
      </div>

      <div className="mt-6 flex flex-1 flex-col">
        {done ? (
          <div className="rounded-3xl bg-white p-6 text-center sm:p-10" data-testid="warm-up-done">
            <p className="text-3xl font-extrabold tracking-tight text-slate-900">
              You&apos;re ready.
            </p>
            <p className="mt-3 text-slate-600">
              Breathe out, slow down, and lead with the result. You know these stories.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIndex(0);
                  setSeconds(0);
                }}
                className="rounded-xl px-4 py-2.5 font-semibold text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50"
              >
                Once more
              </button>
              <Link
                href={exitHref}
                className="rounded-xl bg-ink-800 px-4 py-2.5 font-semibold text-white hover:bg-ink-900"
              >
                Back to the brief
              </Link>
            </div>
          </div>
        ) : (
          <Card key={index} card={cards[index]} />
        )}
      </div>

      {!done && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            disabled={index === 0}
            className="rounded-xl px-4 py-3 font-semibold text-ink-100 ring-1 ring-white/25 hover:bg-white/10 disabled:opacity-40"
          >
            Back
          </button>
          <span className="text-sm text-ink-200">
            {index + 1} of {cards.length}
          </span>
          <button
            type="button"
            onClick={next}
            className="rounded-xl bg-accent-400 px-5 py-3 font-semibold text-ink-950 hover:bg-accent-300"
            data-testid="warm-up-next"
          >
            {index === cards.length - 1 ? "Done" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}

function Card({ card }: { card: WarmUpCard }) {
  const [open, setOpen] = useState(false);
  const shell = "rounded-3xl bg-white p-6 shadow-sm sm:p-8";
  const label = "text-xs font-bold uppercase tracking-wide text-ink-700";

  if (card.kind === "intro") {
    return (
      <div className={shell} data-testid="warm-up-card" data-kind="intro">
        <p className={label}>Tell me about yourself</p>
        {card.intro.whyCompany && (
          <p className="mt-3 border-l-4 border-accent-400 pl-3 text-slate-600 italic">
            {card.intro.whyCompany}
          </p>
        )}
        <div className="mt-4 space-y-3 text-lg leading-relaxed text-slate-800">
          {card.intro.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    );
  }

  if (card.kind === "numbers") {
    return (
      <div className={shell} data-testid="warm-up-card" data-kind="numbers">
        <p className={label}>Your numbers</p>
        <dl className="mt-4 space-y-4">
          {card.numbers.map((n) => (
            <div key={n.id}>
              <dt className="text-slate-500">{n.label}</dt>
              <dd className="text-2xl font-bold text-slate-900">{n.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  const { question, index } = card;
  const story = question.story;
  return (
    <div className={shell} data-testid="warm-up-card" data-kind="question">
      <p className={label}>Question {index + 1}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{question.question}</p>
      {story ? (
        <div className="mt-5 rounded-2xl bg-ink-50 p-4">
          <p className="font-semibold text-ink-900">
            {story.drafted ? "Answer with" : "Story in progress"}: {story.title}
          </p>
          {story.reminder && <p className="mt-1 text-slate-700">{story.reminder}</p>}
          {story.paragraphs.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="mt-3 text-sm font-semibold text-ink-800 hover:underline"
              >
                {open ? "Hide the story" : "Show the story"}
              </button>
              {open && (
                <div className="mt-2 space-y-2 text-slate-800">
                  {story.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-amber-900">
          No story for this yet. Pick one example from your work now, and lead with what you did and
          the result.
        </p>
      )}
    </div>
  );
}

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
