"use client";

import { useState } from "react";
import type { Branch } from "@/lib/quest/tree";
import { LEARNED, SKILL_LEVELS } from "@/lib/stories/skills";

// The skill tree: one column per branch, steps 1 to 5 climbing up, earned steps filled, the next
// step ringed. Tapping a step says what earns it. Wider than a phone, so it scrolls sideways in its
// own box.
export function SkillTree({ branches }: { branches: Branch[] }) {
  const first = branches.find((b) => b.level < 5) ?? branches[0];
  const [picked, setPicked] = useState<{ id: string; step: number }>({
    id: first.id,
    step: Math.min(5, first.level + 1),
  });
  const ready = branches.every((b) => b.level >= LEARNED);
  const learned = branches.filter((b) => b.level >= LEARNED).length;
  const branch = branches.find((b) => b.id === picked.id) ?? first;
  const state =
    picked.step <= branch.level ? "Earned." : picked.step === branch.level + 1 ? "Your next step." : "Not yet.";
  return (
    <section
      className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
      aria-labelledby="tree-heading"
      data-testid="skill-tree"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="tree-heading" className="text-lg font-bold text-slate-900">
          Skill tree
        </h2>
        <span className="text-sm text-slate-600" data-testid="tree-learned">
          {learned} of {branches.length} branches learned
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Six storytelling skills and saying it out loud. A skill is learned once it shows in two of
        your stories, one of them before I asked about it.
      </p>
      <div className="mt-4 overflow-x-auto pb-1">
        <div className="mx-auto flex min-w-[32rem] max-w-3xl flex-col items-stretch gap-3">
          <p
            className={`self-center rounded-xl px-4 py-2 text-center text-sm font-semibold ${
              ready ? "bg-emerald-600 text-white" : "bg-ink-900 text-white"
            }`}
          >
            Interview ready
            <span className="block text-xs font-normal opacity-75">every branch at Learned</span>
          </p>
          <ol className="grid grid-cols-7 gap-1.5">
            {branches.map((b) => (
              <li key={b.id} className="flex flex-col items-center" data-testid={`branch-${b.id}`} data-level={b.level}>
                <ol className="flex flex-col-reverse items-center">
                  {[1, 2, 3, 4, 5].map((step) => {
                    const on = step <= b.level;
                    const next = step === b.level + 1;
                    const selected = picked.id === b.id && picked.step === step;
                    return (
                      <li key={step} className="flex flex-col-reverse items-center">
                        {step > 1 && (
                          <span aria-hidden className={`h-3 w-0.5 ${on ? "bg-emerald-600" : "bg-slate-200"}`} />
                        )}
                        <button
                          type="button"
                          onClick={() => setPicked({ id: b.id, step })}
                          aria-pressed={selected}
                          aria-label={`${b.label}, step ${step}: ${SKILL_LEVELS[step].name}${on ? ", earned" : next ? ", next" : ""}`}
                          className={`grid size-8 place-items-center rounded-full font-mono text-xs transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 ${
                            on
                              ? "bg-emerald-600 text-white"
                              : next
                                ? "bg-white text-accent-800 ring-2 ring-accent-500 ring-offset-2"
                                : "bg-white text-slate-400 ring-2 ring-slate-200"
                          } ${selected ? "scale-110 shadow-md" : ""}`}
                        >
                          {step}
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <span className="mt-2 min-h-[2.6em] text-center text-[0.7rem] leading-tight font-medium text-slate-600">
                  {b.label}
                </span>
              </li>
            ))}
          </ol>
          <p className="border-t border-slate-200 pt-2 text-center text-xs text-slate-500">Your stories</p>
        </div>
      </div>
      <div className="mt-3 rounded-2xl bg-ink-50 px-4 py-3 text-sm" aria-live="polite" data-testid="tree-detail">
        <p className="font-semibold text-slate-900">
          {branch.label} · {SKILL_LEVELS[picked.step].name}
        </p>
        <p className="mt-0.5 text-slate-700">
          {state} {branch.steps[picked.step - 1]}
        </p>
        <p className="mt-1 text-slate-600">{branch.next && picked.step > branch.level ? `Next: ${branch.next}` : branch.what}</p>
      </div>
    </section>
  );
}
