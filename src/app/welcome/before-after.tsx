"use client";

import { useState } from "react";

// The promise in one picture: a rambling answer that flips into the story InterviewMax helps build.
export function BeforeAfter() {
  const [after, setAfter] = useState(false);

  return (
    <div>
      <div
        role="group"
        aria-label="Show the answer before or after InterviewMax"
        className="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200"
      >
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={after === value}
            onClick={() => setAfter(value)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
              after === value ? "bg-ink-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {value ? "After" : "Before"}
          </button>
        ))}
      </div>

      <div className="mt-3 grid [&>*]:col-start-1 [&>*]:row-start-1">
        <figure
          inert={after}
          className={`rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200 transition duration-300 ${
            after ? "pointer-events-none scale-95 opacity-0" : "opacity-100"
          }`}
        >
          <figcaption className="text-xs font-semibold text-slate-500">Before</figcaption>
          <blockquote className="mt-2 text-lg text-slate-600 italic">
            &ldquo;So, there was this onboarding project, and it was kind of a mess, and I helped
            out a lot with fixing things, and in the end it went pretty well, customers liked
            it&hellip;&rdquo;
          </blockquote>
          <button
            type="button"
            onClick={() => setAfter(true)}
            className="mt-4 text-sm font-semibold text-accent-700 hover:text-accent-900"
          >
            Turn it into a story <span aria-hidden>→</span>
          </button>
        </figure>
        <figure
          inert={!after}
          className={`rounded-2xl bg-ink-900 p-5 text-white shadow-lg transition duration-300 ${
            after ? "opacity-100" : "pointer-events-none scale-95 opacity-0"
          }`}
        >
          <figcaption className="text-xs font-semibold text-accent-300">After</figcaption>
          <blockquote className="mt-2 space-y-2 text-[15px] leading-relaxed">
            <p>
              <span className="font-semibold">Situation.</span> 40 enterprise accounts were
              taking 9 weeks to go live, and two were threatening to churn.
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
    </div>
  );
}
