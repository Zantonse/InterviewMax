"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { MicButton } from "@/components/mic-button";
import {
  AUDIENCES,
  MAX_ASK_LENGTH,
  MAX_ASK_QUESTIONS,
  newAskId,
  type AskQuestion,
  type AudienceId,
  type QuestionsToAsk,
} from "@/lib/ask/content";
import { appendSpoken } from "@/lib/voice/text";
import { saveAsk, suggestAsk } from "./ask-actions";

// Questions to ask the interviewer for this job: suggestions grouped by who they suit, which the
// user saves, edits or removes, plus their own. Saved ones show in the pre-interview brief.
export function AskPanel({ jobId, initial }: { jobId: string; initial: QuestionsToAsk | null }) {
  const [questions, setQuestions] = useState<AskQuestion[]>(initial?.questions ?? []);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, startSuggesting] = useTransition();
  const [, startSaving] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);

  const saved = questions.filter((q) => q.saved).length;
  const suggested = questions.some((q) => !q.mine);

  function suggest() {
    setError(null);
    setEditing(null);
    startSuggesting(async () => {
      const result = await suggestAsk(jobId);
      if (result.ok) setQuestions(result.value?.questions ?? []);
      else setError(result.error);
    });
  }

  // Shows the change at once and saves it; puts the list back if the save fails.
  function change(next: AskQuestion[]) {
    const before = questions;
    setQuestions(next);
    setError(null);
    startSaving(async () => {
      const result = await saveAsk(jobId, next);
      if (!result.ok) {
        setQuestions(before);
        setError(result.error);
      }
    });
  }

  const update = (id: string, patch: Partial<AskQuestion>) =>
    change(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const groups = AUDIENCES.map((a) => ({
    ...a,
    questions: questions.filter((q) => q.audience === a.id),
  })).filter((g) => g.questions.length > 0);

  return (
    <div className="flex flex-col gap-4" data-testid="ask-panel">
      {groups.length > 0 && (
        <div className={`flex flex-col gap-4 ${suggesting ? "opacity-60" : ""}`}>
          {groups.map((g) => (
            <div key={g.id}>
              <h3 className="text-sm font-semibold text-slate-900">
                {g.label} <span className="font-normal text-slate-500">· {g.hint}</span>
              </h3>
              <ul className="mt-2 space-y-2">
                {g.questions.map((q) =>
                  editing === q.id ? (
                    <EditRow
                      key={q.id}
                      question={q}
                      onCancel={() => setEditing(null)}
                      onSave={(question, audience) => {
                        setEditing(null);
                        update(q.id, { question, audience, saved: true });
                      }}
                    />
                  ) : (
                    <li
                      key={q.id}
                      className={`rounded-2xl px-4 py-3 ring-1 ${
                        q.saved ? "bg-ink-50 ring-ink-800/15" : "bg-slate-50 ring-black/5"
                      }`}
                      data-testid="ask-question"
                    >
                      <p className="font-medium text-slate-900">{q.question}</p>
                      {q.why && <p className="mt-0.5 text-sm text-slate-500">{q.why}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <button
                          type="button"
                          onClick={() => update(q.id, { saved: !q.saved })}
                          aria-pressed={q.saved}
                          className={`font-semibold ${q.saved ? "text-ink-800" : "text-ink-800 hover:underline"}`}
                        >
                          {q.saved ? "★ Saved for the brief" : "☆ Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(q.id)}
                          className="font-medium text-slate-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => change(questions.filter((x) => x.id !== q.id))}
                          className="font-medium text-slate-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={suggest}
          disabled={suggesting}
          className="rounded-xl bg-ink-800 px-4 py-2.5 font-semibold text-white transition hover:bg-ink-900 disabled:opacity-60"
        >
          {suggesting
            ? "Writing questions for this job…"
            : suggested
              ? "New suggestions"
              : "Suggest questions for this job"}
        </button>
        {saved > 0 && (
          <Link
            href={`/jobs/${jobId}/brief`}
            className="text-sm font-medium text-ink-800 hover:underline"
          >
            {saved} saved, in your brief →
          </Link>
        )}
      </div>
      {suggested && !suggesting && (
        <p className="-mt-2 text-sm text-slate-500">
          New suggestions replace the ones you haven&apos;t saved. Saved ones and your own stay.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {questions.length < MAX_ASK_QUESTIONS && (
        <AddOwn
          disabled={suggesting}
          onAdd={(question, audience) =>
            change([
              ...questions,
              {
                id: newAskId(),
                question,
                audience,
                why: "",
                saved: true,
                mine: true,
              },
            ])
          }
        />
      )}
    </div>
  );
}

function EditRow({
  question,
  onSave,
  onCancel,
}: {
  question: AskQuestion;
  onSave: (question: string, audience: AudienceId) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(question.question);
  const [audience, setAudience] = useState<AudienceId>(question.audience);
  const id = useId();
  return (
    <li className="rounded-2xl bg-white px-4 py-3 ring-2 ring-ink-600/30">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSave(text.trim(), audience);
        }}
      >
        <label htmlFor={id} className="sr-only">
          Your question
        </label>
        <textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={MAX_ASK_LENGTH}
          className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base outline-none focus:border-ink-600 focus:bg-white focus:ring-2 focus:ring-ink-600/20"
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <AudienceSelect value={audience} onChange={setAudience} />
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

function AddOwn({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (question: string, audience: AudienceId) => void;
}) {
  const [text, setText] = useState("");
  const [audience, setAudience] = useState<AudienceId>("hiring_manager");
  const [talking, setTalking] = useState(false);
  const id = useId();
  return (
    <form
      className="flex flex-col gap-2 border-t border-slate-100 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() || talking) return;
        onAdd(text.trim(), audience);
        setText("");
      }}
    >
      <label htmlFor={id} className="text-sm font-semibold text-slate-900">
        Add your own question
      </label>
      <input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_ASK_LENGTH}
        placeholder="Something you really want to know about this job"
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-base outline-none focus:border-ink-600 focus:bg-white focus:ring-2 focus:ring-ink-600/20"
      />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <AudienceSelect value={audience} onChange={setAudience} />
        <button
          type="submit"
          disabled={disabled || talking || !text.trim()}
          className="rounded-lg px-3 py-1.5 font-semibold text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50 disabled:opacity-60"
        >
          Add
        </button>
        <MicButton
          disabled={disabled}
          onActiveChange={setTalking}
          onText={(spoken) => setText((t) => appendSpoken(t, spoken, MAX_ASK_LENGTH))}
        />
      </div>
    </form>
  );
}

function AudienceSelect({
  value,
  onChange,
}: {
  value: AudienceId;
  onChange: (audience: AudienceId) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-slate-600">
      For
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AudienceId)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-900"
      >
        {AUDIENCES.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
    </label>
  );
}
