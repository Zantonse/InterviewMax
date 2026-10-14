"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { MicButton } from "@/components/mic-button";
import { MIN_WORK_ANSWERS, ROLE_FAMILIES, WORK_QUESTIONS } from "@/lib/roles/families";
import {
  FUNCTION_MARKS,
  type FunctionMark,
  type RoleMap,
  answeredCount,
  functionsMarked,
  hasEnoughAnswers,
  roleLabel,
  roleMapStage,
  roleVocabulary,
} from "@/lib/roles/role-map";
import { MAX_ANSWER_LENGTH, getStoryType } from "@/lib/stories/story-types";
import { appendSpoken } from "@/lib/voice/text";
import {
  type RoleResult,
  createRoleProfile,
  saveRoleMarks,
  saveRoleWork,
  applyRoleProfile,
} from "./actions";

const OTHER = "";

type Step = "questions" | "mark" | "profile";

export function RoleMapper({
  storyId,
  initialMap,
}: {
  storyId: string;
  initialMap: RoleMap | undefined;
}) {
  const [map, setMap] = useState(initialMap);
  const stage = roleMapStage(map);
  const [step, setStep] = useState<Step>(
    stage === "questions" ? "questions" : stage === "mark" ? "mark" : "profile",
  );
  const [busy, setBusy] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(label: string, action: () => Promise<RoleResult>, next?: Step) {
    setError(null);
    setBusy(label);
    startTransition(async () => {
      const result = await action();
      setBusy(null);
      if (!result.ok) return setError(result.error);
      setMap(result.roleMap);
      if (next) setStep(next);
    });
  }

  return (
    <div className="mt-4">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        Map my role
      </h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Hard to describe what you did? Start with the work itself. Then see the whole function laid
        out and mark your part of it. A slice of a function is a specialty, not a gap.
      </p>

      <ol className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Steps">
        {(
          [
            ["questions", "1. Your work"],
            ["mark", "2. Your part"],
            ["profile", "3. Your profile"],
          ] as const
        ).map(([id, label]) => (
          <li
            key={id}
            aria-current={step === id ? "step" : undefined}
            className={`rounded-full px-3 py-1 font-medium ${
              step === id ? "bg-navy-800 text-white" : "bg-white text-slate-500 ring-1 ring-black/5"
            }`}
          >
            {label}
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {step === "questions" && (
          <WorkQuestions
            map={map}
            busy={busy}
            onSubmit={(familyId, answers) =>
              run(
                familyId ? "Mapping your role…" : "Mapping your role. This takes a moment…",
                () => saveRoleWork(storyId, familyId, answers),
                "mark",
              )
            }
          />
        )}
        {step === "mark" && map && (
          <MarkFunctions
            map={map}
            busy={busy}
            onBack={() => setStep("questions")}
            onSubmit={(marks) =>
              run(
                "Writing your role profile…",
                async () => {
                  const saved = await saveRoleMarks(storyId, marks);
                  return saved.ok ? createRoleProfile(storyId) : saved;
                },
                "profile",
              )
            }
          />
        )}
        {step === "profile" && map && (
          <Profile
            map={map}
            busy={busy}
            onWrite={() => run("Writing your role profile…", () => createRoleProfile(storyId))}
            onUse={() =>
              run("Adding it to Tell me about yourself…", () => applyRoleProfile(storyId))
            }
            onEditAnswers={() => setStep("questions")}
            onEditMarks={() => setStep("mark")}
          />
        )}
      </div>

      {busy && (
        <p role="status" className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-navy-600" />
          {busy}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

function WorkQuestions({
  map,
  busy,
  onSubmit,
}: {
  map: RoleMap | undefined;
  busy: string | null;
  onSubmit: (familyId: string, answers: Record<string, string>) => void;
}) {
  const [familyId, setFamilyId] = useState(map ? (map.familyId ?? OTHER) : ROLE_FAMILIES[0].id);
  const [answers, setAnswers] = useState<Record<string, string>>(map?.answers ?? {});
  const familyField = useId();
  const ready = hasEnoughAnswers(answers);

  return (
    <form
      className="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !busy) onSubmit(familyId, answers);
      }}
    >
      <div>
        <label htmlFor={familyField} className="font-semibold text-slate-900">
          Which kind of work is closest?
        </label>
        <select
          id={familyField}
          value={familyId}
          onChange={(e) => setFamilyId(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
        >
          {ROLE_FAMILIES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
          <option value={OTHER}>Something else (I&apos;ll map it from your answers)</option>
        </select>
      </div>

      {WORK_QUESTIONS.map((q) => (
        <WorkField
          key={q.id}
          label={q.text}
          value={answers[q.id] ?? ""}
          onChange={(value) => setAnswers((a) => ({ ...a, [q.id]: value }))}
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {answeredCount(answers)} of {WORK_QUESTIONS.length} answered. Your job title and{" "}
          {MIN_WORK_ANSWERS - 1} more are enough to start; plain notes are fine.
        </p>
        <button
          type="submit"
          disabled={!ready || Boolean(busy)}
          className="rounded-xl bg-navy-800 px-5 py-2 font-semibold text-white hover:bg-navy-900 disabled:opacity-50"
        >
          Map my role
        </button>
      </div>
    </form>
  );
}

function WorkField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-slate-800">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={MAX_ANSWER_LENGTH}
        className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-navy-600 focus:bg-white focus:ring-2 focus:ring-navy-600/20"
      />
      <div className="mt-1">
        <MicButton onText={(spoken) => onChange(appendSpoken(value, spoken, MAX_ANSWER_LENGTH))} />
      </div>
    </div>
  );
}

function MarkFunctions({
  map,
  busy,
  onBack,
  onSubmit,
}: {
  map: RoleMap;
  busy: string | null;
  onBack: () => void;
  onSubmit: (marks: Record<string, FunctionMark>) => void;
}) {
  const [marks, setMarks] = useState<Record<string, FunctionMark>>(map.marks);
  const allMarked = map.functions.every((f) => marks[f.id]);

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{roleLabel(map)}: the whole function</h2>
        <p className="mt-1 text-slate-600">
          These are the usual parts of this kind of work. Mark each one. Most people own a few
          parts, help with some, and never touch the rest.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-slate-100">
        {map.functions.map((f) => (
          <li key={f.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{f.label}</p>
              <p className="text-sm text-slate-500">{f.blurb}</p>
            </div>
            <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={f.label}>
              {FUNCTION_MARKS.map((m) => {
                const on = marks[f.id] === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setMarks((s) => ({ ...s, [f.id]: m.id }))}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${
                      on
                        ? m.id === "not_mine"
                          ? "bg-slate-600 text-white ring-slate-600"
                          : "bg-navy-800 text-white ring-navy-800"
                        : "text-slate-600 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl px-4 py-2 font-medium text-slate-600 hover:bg-slate-100"
        >
          Back to my answers
        </button>
        <button
          type="button"
          disabled={!allMarked || Boolean(busy)}
          onClick={() => onSubmit(marks)}
          className="rounded-xl bg-navy-800 px-5 py-2 font-semibold text-white hover:bg-navy-900 disabled:opacity-50"
        >
          Next: my role profile
        </button>
      </div>
    </div>
  );
}

function Profile({
  map,
  busy,
  onWrite,
  onUse,
  onEditAnswers,
  onEditMarks,
}: {
  map: RoleMap;
  busy: string | null;
  onWrite: () => void;
  onUse: () => void;
  onEditAnswers: () => void;
  onEditMarks: () => void;
}) {
  const profile = map.profile;
  const owned = functionsMarked(map, "owned");
  const contributed = functionsMarked(map, "contributed");
  const words = roleVocabulary(map);

  return (
    <article
      className="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
      data-testid="role-profile"
    >
      <header>
        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Role profile</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          {map.answers.title?.split("\n")[0] || roleLabel(map)}
        </h2>
      </header>

      <Section title="Your specialty">
        {owned.length > 0 && (
          <p>
            <span className="font-semibold">Owned:</span> {owned.map((f) => f.label).join(", ")}
          </p>
        )}
        {contributed.length > 0 && (
          <p className="mt-1">
            <span className="font-semibold">Contributed to:</span>{" "}
            {contributed.map((f) => f.label).join(", ")}
          </p>
        )}
      </Section>

      {words.length > 0 && (
        <Section title="Words interviewers use for it">
          <ul className="flex flex-wrap gap-2">
            {words.map((w) => (
              <li key={w} className="rounded-full bg-navy-50 px-3 py-1 text-sm text-navy-900">
                {w}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {profile ? (
        <>
          {profile.scope && (
            <Section title="Your scope">
              <p>{profile.scope}</p>
            </Section>
          )}
          {profile.strengths.length > 0 && (
            <Section title="Your strengths">
              <ul className="list-disc space-y-1 pl-5">
                {profile.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Section>
          )}
          {profile.fit && (
            <Section title="How it lines up with what's next">
              <p>{profile.fit}</p>
            </Section>
          )}
          {profile.storyIdeas.length > 0 && (
            <Section title="Stories to build first">
              <ul className="space-y-2">
                {profile.storyIdeas.map((s) => (
                  <li key={s.storyType}>
                    <span className="font-semibold">
                      {getStoryType(s.storyType)?.label ?? s.storyType}:
                    </span>{" "}
                    {s.why}
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <p className="text-sm text-slate-500">
            Built only from your answers. The function&apos;s vocabulary gives you words for work
            you described; it doesn&apos;t add anything you didn&apos;t do.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={onUse}
              className="rounded-xl bg-navy-800 px-5 py-2 font-semibold text-white hover:bg-navy-900 disabled:opacity-50"
            >
              Use this for Tell me about yourself
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={onWrite}
              className="rounded-xl px-4 py-2 font-semibold text-navy-800 ring-1 ring-navy-800/30 hover:bg-navy-50 disabled:opacity-50"
            >
              Rewrite the profile
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-slate-50 p-4">
          <p className="text-slate-700">
            Next I&apos;ll write a one-page profile from your answers: your scope, strengths, and
            the stories worth building first.
          </p>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={onWrite}
            className="rounded-xl bg-navy-800 px-5 py-2 font-semibold text-white hover:bg-navy-900 disabled:opacity-50"
          >
            Write my role profile
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-sm">
        <button
          type="button"
          onClick={onEditAnswers}
          className="font-medium text-navy-800 hover:underline"
        >
          Edit my answers
        </button>
        <button
          type="button"
          onClick={onEditMarks}
          className="font-medium text-navy-800 hover:underline"
        >
          Change my part
        </button>
        <Link href="/" className="font-medium text-slate-500 hover:underline">
          Back to my prep
        </Link>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-bold uppercase tracking-wide text-navy-800">{title}</h3>
      <div className="mt-2 leading-relaxed text-slate-800">{children}</div>
    </section>
  );
}
