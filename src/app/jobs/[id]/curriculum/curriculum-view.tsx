"use client";

import { useState, useTransition } from "react";
import {
  CONFIDENCE,
  byArea,
  progress,
  type ConfidenceId,
  type Curriculum,
  type CurriculumTopic,
  withConfidence,
} from "@/lib/curriculum/content";
import { makeCurriculum, markTopic } from "./actions";

// The curriculum for one job: a short summary of the role, then the topics by area. The user
// marks each topic; "Only what's left" hides the ones they know.
export function CurriculumView({
  jobId,
  hasPosting,
  initial,
}: {
  jobId: string;
  hasPosting: boolean;
  initial: Curriculum | null;
}) {
  const [curriculum, setCurriculum] = useState<Curriculum | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [onlyLeft, setOnlyLeft] = useState(false);
  const [writing, startWriting] = useTransition();
  const [, startSaving] = useTransition();

  function write() {
    setError(null);
    startWriting(async () => {
      const result = await makeCurriculum(jobId);
      if (result.ok) setCurriculum(result.value);
      else setError(result.error);
    });
  }

  // Shows the mark at once and saves it; puts it back if the save fails.
  function mark(topic: CurriculumTopic, confidence: ConfidenceId) {
    if (!curriculum) return;
    const before = curriculum;
    const next = topic.confidence === confidence ? undefined : confidence;
    setCurriculum({
      ...curriculum,
      topics: curriculum.topics.map((t) => (t.id === topic.id ? withConfidence(t, next) : t)),
    });
    setError(null);
    startSaving(async () => {
      const result = await markTopic(jobId, topic.id, next ?? null);
      if (!result.ok) {
        setCurriculum(before);
        setError(result.error);
      }
    });
  }

  if (!hasPosting) {
    return (
      <p className="mt-6 rounded-3xl bg-amber-50 p-6 text-slate-700 ring-1 ring-black/5">
        This job has no posting text yet. Add the posting to the job and come back: the curriculum
        is built from it.
      </p>
    );
  }

  if (!curriculum) {
    return (
      <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-slate-700">
          We&apos;ll read the posting and list the topics to know, the ones it stresses first.
          Anything the posting doesn&apos;t name is marked as usual for the role.
        </p>
        <button
          type="button"
          onClick={write}
          disabled={writing}
          className="mt-4 rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-900 disabled:opacity-60"
          data-testid="curriculum-make"
        >
          {writing ? "Reading the posting…" : "Build my curriculum"}
        </button>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </section>
    );
  }

  const { known, toStudy } = progress(curriculum.topics);
  const shown = onlyLeft
    ? curriculum.topics.filter((t) => t.confidence !== "know")
    : curriculum.topics;
  const areas = byArea(shown);

  return (
    <div
      className={`mt-6 flex flex-col gap-6 ${writing ? "opacity-60" : ""}`}
      data-testid="curriculum"
    >
      {curriculum.summary && (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">
            The job in short
          </h2>
          <p className="text-slate-700">{curriculum.summary}</p>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white px-5 py-3 shadow-sm ring-1 ring-black/5">
        <p className="min-w-0 flex-1 text-sm text-slate-600" data-testid="curriculum-progress">
          <span className="font-semibold text-slate-900">
            {known} of {curriculum.topics.length} known.
          </span>{" "}
          {toStudy === 0 ? "You have the basics down." : `${toStudy} to study.`}
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyLeft}
            onChange={(e) => setOnlyLeft(e.target.checked)}
            className="size-4 accent-ink-800"
          />
          Only what&apos;s left
        </label>
        <button
          type="button"
          onClick={write}
          disabled={writing}
          className="text-sm font-semibold text-ink-800 hover:underline disabled:opacity-60"
        >
          {writing ? "Rewriting…" : "Rewrite from the posting"}
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}

      {areas.length === 0 && (
        <p className="rounded-3xl bg-white p-6 text-slate-700 shadow-sm ring-1 ring-black/5">
          Every topic is marked as known.
        </p>
      )}

      {areas.map((area) => (
        <section key={area.id}>
          <h2 className="text-lg font-bold text-slate-900">
            {area.label} <span className="text-sm font-normal text-slate-500">· {area.hint}</span>
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {area.topics.map((t) => (
              <TopicCard key={t.id} topic={t} onMark={(c) => mark(t, c)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TopicCard({
  topic,
  onMark,
}: {
  topic: CurriculumTopic;
  onMark: (confidence: ConfidenceId) => void;
}) {
  return (
    <li
      className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"
      data-testid="curriculum-topic"
    >
      <div>
        <h3 className="font-semibold text-slate-900">{topic.name}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {topic.quote ? (
            <>
              From the posting: <q className="italic">{topic.quote}</q>
            </>
          ) : (
            "Not named in the posting; usual for this kind of role"
          )}
        </p>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        {topic.basics.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {topic.askedAs && (
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">How it comes up: </span>
          {topic.askedAs}
        </p>
      )}
      {topic.check && (
        <details className="text-sm text-slate-600">
          <summary className="cursor-pointer font-semibold text-ink-800">Test yourself</summary>
          <p className="mt-1">{topic.check}</p>
        </details>
      )}
      <div
        className="mt-auto flex flex-wrap gap-2"
        role="group"
        aria-label={`How well you know ${topic.name}`}
      >
        {CONFIDENCE.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={topic.confidence === c.id}
            onClick={() => onMark(c.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
              topic.confidence === c.id
                ? "bg-ink-800 text-white ring-ink-800"
                : "bg-white text-slate-700 ring-slate-300 hover:ring-ink-800"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </li>
  );
}
