"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import {
  FITS,
  GOOD_SET_STORIES,
  MAX_BULLET_LENGTH,
  UNNAMED_ROLE,
  groupByRole,
  hasFigure,
  resumeText,
  type ResumeBullet,
  type ResumeSet,
} from "@/lib/resume/content";
import { buildResume, saveResume } from "./resume-actions";

// Resume bullets for this job, written from the user's finished stories: a two-line summary from
// About me, then bullets grouped by role, best fit first, to copy into the resume they already
// have. The user edits, removes or adds back bullets; every figure traces to their answers.
export function ResumePanel({
  jobId,
  initial,
  finishedCount,
  changedCount,
}: {
  jobId: string;
  initial: ResumeSet | null;
  // Behavioral stories with a written draft.
  finishedCount: number;
  // Finished stories new, rewritten or gone since the set was written.
  changedCount: number;
}) {
  const [set, setSet] = useState<ResumeSet | null>(initial);
  const [changed, setChanged] = useState(changedCount);
  const [error, setError] = useState<string | null>(null);
  const [building, startBuilding] = useTransition();
  const [, startSaving] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function build() {
    setError(null);
    setEditing(null);
    startBuilding(async () => {
      const result = await buildResume(jobId);
      if (result.ok) {
        setSet(result.value);
        setChanged(0);
      } else setError(result.error);
    });
  }

  // Shows the change at once and saves it; puts the set back if the save fails.
  function change(bullets: ResumeBullet[]) {
    if (!set) return;
    const before = set;
    setSet({ ...set, bullets });
    setError(null);
    startSaving(async () => {
      const result = await saveResume(jobId, bullets);
      if (result.ok) setSet(result.value);
      else {
        setSet(before);
        setError(result.error);
      }
    });
  }

  const update = (id: string, patch: Partial<ResumeBullet>) =>
    set && change(set.bullets.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      setError("Copying didn't work in this browser. Select the text and copy it instead.");
    }
  }

  if (finishedCount === 0 && !set) {
    return (
      <p className="text-slate-600" data-testid="resume-panel">
        Bullets come from your written stories, so they quote the same numbers you&apos;ll say in
        the interview.{" "}
        <Link href="/stories" className="font-semibold text-ink-800 underline">
          Finish a story
        </Link>{" "}
        and come back here.
      </p>
    );
  }

  const groups = set ? groupByRole(set.bullets) : [];
  const unpicked = set?.bullets.filter((b) => !b.picked) ?? [];

  return (
    <div className="flex flex-col gap-4" data-testid="resume-panel">
      {set && (
        <div className={`flex flex-col gap-5 ${building ? "opacity-60" : ""}`}>
          {set.summary ? (
            <div className="rounded-2xl bg-ink-50 px-4 py-3 ring-1 ring-ink-800/15">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-800">Summary</h3>
              <p className="mt-1 text-slate-900" data-testid="resume-summary">
                {set.summary}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                From your About me
                {set.summarySource === "tailored" ? " for this job" : ""}.{" "}
                <button
                  type="button"
                  onClick={() => copy("summary", set.summary)}
                  className="font-semibold text-ink-800 hover:underline"
                >
                  {copied === "summary" ? "Copied" : "Copy"}
                </button>
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No summary yet: it comes from{" "}
              <a href="#about-me" className="font-semibold text-ink-800 underline">
                About me for this job
              </a>
              . Write that, then write the bullets again.
            </p>
          )}

          {groups.map((g) => (
            <div key={g.role}>
              <h3 className="text-sm font-semibold text-slate-900">
                {g.role}
                {g.role === UNNAMED_ROLE && (
                  <span className="font-normal text-slate-500">
                    {" "}
                    · edit a bullet to say where it goes
                  </span>
                )}
              </h3>
              <ul className="mt-2 space-y-2">
                {g.bullets.map((b) =>
                  editing === b.id ? (
                    <EditRow
                      key={b.id}
                      bullet={b}
                      onCancel={() => setEditing(null)}
                      onSave={(text, role) => {
                        setEditing(null);
                        update(b.id, { text, role });
                      }}
                    />
                  ) : (
                    <BulletRow
                      key={b.id}
                      bullet={b}
                      copied={copied === b.id}
                      onCopy={() => copy(b.id, b.text)}
                      onEdit={() => setEditing(b.id)}
                      onRemove={() => update(b.id, { picked: false })}
                    />
                  ),
                )}
              </ul>
            </div>
          ))}

          {unpicked.length > 0 && (
            <details className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5">
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                Left out for this job ({unpicked.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {unpicked.map((b) => (
                  <li key={b.id} className="text-sm text-slate-700">
                    {b.text}{" "}
                    <button
                      type="button"
                      onClick={() => update(b.id, { picked: true })}
                      className="font-semibold text-ink-800 hover:underline"
                    >
                      Add back
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {set.leftOut > 0 && (
            <p className="text-sm text-slate-500">
              {set.leftOut === 1 ? "One bullet was" : `${set.leftOut} bullets were`} left out
              because a figure in it wasn&apos;t in your answers.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={build}
          disabled={building}
          className="rounded-xl bg-ink-800 px-4 py-2.5 font-semibold text-white transition hover:bg-ink-900 disabled:opacity-60"
        >
          {building
            ? "Writing bullets from your stories…"
            : set
              ? "Write them again"
              : "Write my resume bullets"}
        </button>
        {set && groups.length > 0 && (
          <button
            type="button"
            onClick={() => copy("all", resumeText(set))}
            className="rounded-xl px-4 py-2.5 font-semibold text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50"
          >
            {copied === "all" ? "Copied" : "Copy all"}
          </button>
        )}
      </div>
      {set && changed > 0 && !building && (
        <p className="-mt-2 text-sm text-amber-800" data-testid="resume-stale">
          {changed === 1 ? "One story has" : `${changed} stories have`} changed since these were
          written. Write them again to catch up; your edits here will be replaced.
        </p>
      )}
      {!set && finishedCount < GOOD_SET_STORIES && (
        <p className="-mt-2 text-sm text-slate-500">
          You have {finishedCount} finished {finishedCount === 1 ? "story" : "stories"}. Bullets
          work from what you have, and the set gets stronger at {GOOD_SET_STORIES} or more.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function BulletRow({
  bullet: b,
  copied,
  onCopy,
  onEdit,
  onRemove,
}: {
  bullet: ResumeBullet;
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const fit = FITS.find((f) => f.id === b.fit);
  return (
    <li
      className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5"
      data-testid="resume-bullet"
    >
      <p className="font-medium text-slate-900">• {b.text}</p>
      <p className="mt-0.5 text-sm text-slate-500">
        {fit && b.fit !== "none" && <span className="font-semibold text-ink-800">{fit.label}</span>}
        {b.why && <> · {b.why}</>} · from{" "}
        <Link href={`/stories/${b.storyId}`} className="underline hover:text-slate-700">
          {b.storyTitle || "your story"}
        </Link>
      </p>
      {b.untracedNumbers.length > 0 && (
        <p className="mt-1 text-sm text-amber-800">
          {b.untracedNumbers.join(", ")} isn&apos;t in that story&apos;s answers. Make sure
          it&apos;s right before it goes on your resume.
        </p>
      )}
      {!hasFigure(b.text) && (
        <p className="mt-1 text-sm text-slate-500">
          No number yet. If you know one, add it to{" "}
          <Link href={`/stories/${b.storyId}`} className="font-semibold text-ink-800 underline">
            the story
          </Link>{" "}
          or{" "}
          <Link href="/numbers" className="font-semibold text-ink-800 underline">
            your numbers
          </Link>
          , then write the bullets again.
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <button
          type="button"
          onClick={onCopy}
          className="font-semibold text-ink-800 hover:underline"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="font-medium text-slate-600 hover:underline"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="font-medium text-slate-500 hover:text-red-700"
        >
          Leave out
        </button>
      </div>
    </li>
  );
}

function EditRow({
  bullet,
  onSave,
  onCancel,
}: {
  bullet: ResumeBullet;
  onSave: (text: string, role: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(bullet.text);
  const [role, setRole] = useState(bullet.role);
  const id = useId();
  return (
    <li className="rounded-2xl bg-white px-4 py-3 ring-2 ring-ink-600/30">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSave(text.trim(), role.trim());
        }}
      >
        <label htmlFor={`${id}-text`} className="sr-only">
          Bullet
        </label>
        <textarea
          id={`${id}-text`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={MAX_BULLET_LENGTH}
          className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base outline-none focus:border-ink-600 focus:bg-white focus:ring-2 focus:ring-ink-600/20"
        />
        <label htmlFor={`${id}-role`} className="text-sm text-slate-600">
          Goes under (title and employer)
        </label>
        <input
          id={`${id}-role`}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          maxLength={200}
          placeholder="e.g. Senior Account Executive, Acme"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base outline-none focus:border-ink-600 focus:bg-white focus:ring-2 focus:ring-ink-600/20"
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="submit"
            disabled={!text.trim()}
            className="rounded-lg bg-ink-800 px-3 py-1.5 font-semibold text-white hover:bg-ink-900 disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="font-medium text-slate-600 hover:underline"
          >
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}
