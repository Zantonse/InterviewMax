"use client";

import { useState } from "react";
import { SectionHead } from "@/components/section-head";
import type { Branch } from "@/lib/quest/tree";
import { LEARNED, SKILL_LEVELS } from "@/lib/stories/skills";

// The skill tree: one column per branch, steps 1 to 5 climbing up, earned steps filled in graphite,
// the next step ringed in the coach's pen. Tapping a step says what earns it. Wider than a phone,
// so it scrolls sideways in its own box.
export function SkillTree({ branches }: { branches: Branch[] }) {
  // Opens on the weakest branch's next step.
  const first = [...branches].sort((a, b) => a.level - b.level)[0];
  const [picked, setPicked] = useState<{ id: string; step: number }>({
    id: first.id,
    step: Math.min(5, first.level + 1),
  });
  const learned = branches.filter((b) => b.level >= LEARNED).length;
  const ready = learned === branches.length;
  const branch = branches.find((b) => b.id === picked.id) ?? first;
  const state =
    picked.step <= branch.level
      ? "Earned."
      : picked.step === branch.level + 1
        ? "Your next step."
        : "Not yet.";
  return (
    <section aria-labelledby="tree-heading" data-testid="skill-tree">
      <SectionHead
        id="tree-heading"
        title="Skill tree"
        note={<span data-testid="tree-learned">{learned} of {branches.length} learned</span>}
      />
      <p className="mt-3 max-w-2xl text-sm text-slate-600">
        Six storytelling skills and saying it out loud. A skill is learned once it shows in two of
        your stories, one of them before a follow-up question asked for it.
      </p>
      <div className="mt-5 overflow-x-auto pb-1">
        <div className="flex min-w-[32rem] max-w-3xl flex-col items-stretch gap-3">
          <p className="self-center text-center text-sm">
            <span className={`font-semibold ${ready ? "text-emerald-800" : "text-slate-900"}`}>
              Interview ready
            </span>
            <span className="block text-slate-600">every branch at Learned</span>
          </p>
          <ol className="grid grid-cols-7 gap-1.5">
            {branches.map((b) => (
              <li
                key={b.id}
                className="flex flex-col items-center"
                data-testid={`branch-${b.id}`}
                data-level={b.level}
              >
                <ol className="flex flex-col-reverse items-center">
                  {[1, 2, 3, 4, 5].map((step) => {
                    const on = step <= b.level;
                    const next = step === b.level + 1;
                    const selected = picked.id === b.id && picked.step === step;
                    return (
                      <li key={step} className="flex flex-col-reverse items-center">
                        {step > 1 && (
                          <span aria-hidden className={`h-3 w-px ${on ? "bg-ink-900" : "bg-ink-200"}`} />
                        )}
                        <button
                          type="button"
                          onClick={() => setPicked({ id: b.id, step })}
                          aria-pressed={selected}
                          aria-label={`${b.label}, step ${step}: ${SKILL_LEVELS[step].name}${on ? ", earned" : next ? ", next" : ""}`}
                          className={`grid size-7 place-items-center rounded-full font-mono text-[0.8125rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 ${
                            on
                              ? "bg-ink-900 text-white"
                              : next
                                ? "bg-white text-slate-900 ring-2 ring-accent-500"
                                : "bg-white text-slate-500 ring-1 ring-ink-200"
                          } ${selected ? "outline-2 outline-offset-2 outline-ink-400" : ""}`}
                        >
                          {step}
                        </button>
                      </li>
                    );
                  })}
                </ol>
                <span className="mt-2 min-h-[2.6em] text-center text-[0.8125rem] leading-tight text-slate-700">
                  {b.label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="mt-4 max-w-2xl border-t border-ink-100 pt-3 text-sm" aria-live="polite" data-testid="tree-detail">
        <p className="font-semibold text-slate-900">
          {branch.label} · {SKILL_LEVELS[picked.step].name}
        </p>
        <p className="mt-0.5 text-slate-700">
          {state} {branch.steps[picked.step - 1]}
        </p>
        <p className="mt-1 text-slate-600">
          {branch.next && picked.step > branch.level ? `Next: ${branch.next}` : branch.what}
        </p>
      </div>
    </section>
  );
}
