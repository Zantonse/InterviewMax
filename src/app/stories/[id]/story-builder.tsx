"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import {
  builderStage,
  nextCoreQuestion,
  nextFollowUpIndex,
  type StoryContent,
} from "@/lib/stories/content";
import {
  CORE_QUESTIONS,
  MAX_ANSWER_LENGTH,
  STORY_PARTS,
  coreQuestionText,
  getStoryType,
  type CoreQuestionId,
  type StoryPartId,
} from "@/lib/stories/story-types";
import {
  askFollowUps,
  saveAnswer,
  saveFollowUpAnswer,
  writeDraft,
  type BuilderResult,
} from "./actions";

type Busy = null | "saving" | "probing" | "writing";
type Editing = null | { kind: "core"; id: CoreQuestionId } | { kind: "followUp"; index: number };

// Where a follow-up's answer shows up in the story panel, by the gap it was aimed at.
const GAP_TO_PART: Record<string, StoryPartId> = {
  situation: "situation",
  context: "situation",
  ownership: "role",
  role: "role",
  actions: "actions",
  decision: "actions",
  result: "result",
  reflection: "reflection",
};

export function StoryBuilder({
  storyId,
  storyTypeId,
  initialTitle,
  initialContent,
}: {
  storyId: string;
  storyTypeId: string | null;
  initialTitle: string;
  initialContent: StoryContent;
}) {
  const storyType = getStoryType(storyTypeId);
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [, startTransition] = useTransition();

  const stage = builderStage(content);

  // Runs a chain of actions, applying each result. Stops at the first error.
  function run(steps: { busy: Exclude<Busy, null>; action: () => Promise<BuilderResult> }[]) {
    setError(null);
    startTransition(async () => {
      for (const step of steps) {
        setBusy(step.busy);
        const result = await step.action();
        if (!result.ok) {
          setError(result.error);
          break;
        }
        setContent(result.content);
        setTitle(result.title);
        // After the last scripted answer, go straight on to call one; after the last
        // follow-up, straight on to call two.
        const next = builderStage(result.content);
        if (step.busy === "saving" && next === "probe") {
          steps.push({ busy: "probing", action: () => askFollowUps(storyId) });
        } else if (step.busy === "saving" && next === "write") {
          steps.push({ busy: "writing", action: () => writeDraft(storyId) });
        }
      }
      setBusy(null);
    });
  }

  function submitCore(id: CoreQuestionId, answer: string) {
    setEditing(null);
    run([{ busy: "saving", action: () => saveAnswer(storyId, id, answer) }]);
  }

  function submitFollowUp(index: number, answer: string) {
    setEditing(null);
    run([{ busy: "saving", action: () => saveFollowUpAnswer(storyId, index, answer) }]);
  }

  const currentCore = nextCoreQuestion(content);
  const currentFollowUp = nextFollowUpIndex(content);
  const coreAnswered = CORE_QUESTIONS.filter((q) => content.answers[q.id]?.trim()).length;
  const askedCore = CORE_QUESTIONS.filter(
    (q) => content.answers[q.id]?.trim() || q.id === currentCore,
  );

  return (
    <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      {/* The conversation */}
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-sm font-bold uppercase tracking-wide text-teal-800">
            {storyType?.label ?? "Your story"}
          </h1>
          <p className="shrink-0 whitespace-nowrap text-sm text-slate-500" data-testid="progress">
            {progressLabel(stage, coreAnswered, content)}
          </p>
        </div>

        <ol className="mt-5 flex flex-col gap-4">
          {askedCore.map((q) => {
            const answer = content.answers[q.id];
            const isEditing = editing?.kind === "core" && editing.id === q.id;
            return (
              <Exchange
                key={q.id}
                question={coreQuestionText(q.id, storyType)}
                answer={answer}
                isCurrent={q.id === currentCore}
                isEditing={isEditing}
                disabled={busy !== null}
                onEdit={() => setEditing({ kind: "core", id: q.id })}
                onCancel={() => setEditing(null)}
                onSubmit={(text) => submitCore(q.id, text)}
              />
            );
          })}

          {content.followUps && content.followUps.length > 0 && (
            <CoachLine>
              Thanks. A few follow-ups to fill the gaps before I write it up:
            </CoachLine>
          )}

          {content.followUps?.map((f, index) => {
            if (index > (currentFollowUp ?? Infinity)) return null;
            const isEditing = editing?.kind === "followUp" && editing.index === index;
            return (
              <Exchange
                key={index}
                question={f.question}
                answer={f.answer}
                isCurrent={index === currentFollowUp}
                isEditing={isEditing}
                disabled={busy !== null}
                onEdit={() => setEditing({ kind: "followUp", index })}
                onCancel={() => setEditing(null)}
                onSubmit={(text) => submitFollowUp(index, text)}
              />
            );
          })}

          {busy === "probing" && <Thinking>Reading your answers…</Thinking>}
          {busy === "writing" && <Thinking>Writing your story from your answers…</Thinking>}

          {!busy && stage === "probe" && (
            <ActionLine
              text="All eight answered. Next I'll look for gaps and ask two or three follow-ups."
              button="Get follow-up questions"
              onClick={() => run([{ busy: "probing", action: () => askFollowUps(storyId) }])}
            />
          )}
          {!busy && stage === "write" && (
            <ActionLine
              text="That's everything I need."
              button="Write my story"
              onClick={() => run([{ busy: "writing", action: () => writeDraft(storyId) }])}
            />
          )}
          {!busy && stage === "drafted" && (
            <ActionLine
              text={
                content.draft?.untracedNumbers.length
                  ? "Your draft is ready, but check the highlighted figures: they aren't in your answers. Fix an answer or rewrite the story."
                  : "Your draft is ready, built only from what you told me. If you change an answer, rewrite it to pick up the change."
              }
              button="Rewrite the story"
              secondary
              onClick={() => run([{ busy: "writing", action: () => writeDraft(storyId) }])}
            />
          )}
        </ol>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
      </section>

      {/* The story assembling */}
      <StoryPanel
        title={title}
        content={content}
        storyTypeLabel={storyType?.label}
        writing={busy === "writing"}
      />
    </div>
  );
}

function progressLabel(stage: ReturnType<typeof builderStage>, coreAnswered: number, content: StoryContent) {
  switch (stage) {
    case "core":
      return `Question ${coreAnswered + 1} of ${CORE_QUESTIONS.length}`;
    case "probe":
      return "Questions done";
    case "follow_ups": {
      const total = content.followUps?.length ?? 0;
      return `Follow-up ${(nextFollowUpIndex(content) ?? 0) + 1} of ${total}`;
    }
    case "write":
      return "Ready to write";
    case "drafted":
      return "Draft written";
  }
}

function Exchange({
  question,
  answer,
  isCurrent,
  isEditing,
  disabled,
  onEdit,
  onCancel,
  onSubmit,
}: {
  question: string;
  answer: string | undefined;
  isCurrent: boolean;
  isEditing: boolean;
  disabled: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSubmit: (answer: string) => void;
}) {
  return (
    <li className="flex flex-col gap-2">
      <CoachBubble>{question}</CoachBubble>
      {isCurrent || isEditing ? (
        <Composer
          key={isEditing ? "edit" : "new"}
          initial={isEditing ? (answer ?? "") : ""}
          disabled={disabled}
          submitLabel={isEditing ? "Save" : "Next"}
          onSubmit={onSubmit}
          onCancel={isEditing ? onCancel : undefined}
        />
      ) : answer ? (
        <div className="flex flex-col items-end gap-1">
          <p className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-teal-800 px-4 py-3 text-white">
            {answer}
          </p>
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            className="text-xs font-medium text-slate-500 hover:text-teal-800 disabled:opacity-50"
          >
            Edit
          </button>
        </div>
      ) : null}
    </li>
  );
}

function Composer({
  initial,
  disabled,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: string;
  disabled: boolean;
  submitLabel: string;
  onSubmit: (answer: string) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const canSubmit = !disabled && text.trim().length > 0;

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(text);
      }}
    >
      <label className="sr-only" htmlFor={fieldId}>
        Your answer
      </label>
      <textarea
        id={fieldId}
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
            e.preventDefault();
            onSubmit(text);
          }
        }}
        rows={4}
        maxLength={MAX_ANSWER_LENGTH}
        placeholder="Type your answer. Plain notes are fine."
        className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/20"
      />
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto hidden text-xs text-slate-400 sm:inline">
          Ctrl or ⌘ + Enter to send
        </span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-xl bg-teal-800 px-5 py-2 font-semibold text-white transition hover:bg-teal-900 disabled:opacity-50"
        >
          {disabled ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function CoachBubble({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-teal-50 px-4 py-3 text-slate-800">
      {children}
    </p>
  );
}

function CoachLine({ children }: { children: React.ReactNode }) {
  return <li className="pt-2 text-sm font-semibold text-teal-900">{children}</li>;
}

function Thinking({ children }: { children: React.ReactNode }) {
  return (
    <li role="status" className="flex items-center gap-2 text-sm text-slate-600">
      <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" />
      {children}
    </li>
  );
}

function ActionLine({
  text,
  button,
  secondary,
  onClick,
}: {
  text: string;
  button: string;
  secondary?: boolean;
  onClick: () => void;
}) {
  return (
    <li className="flex flex-col items-start gap-3 rounded-2xl bg-slate-50 p-4">
      <p className="text-slate-700">{text}</p>
      <button
        type="button"
        onClick={onClick}
        className={
          secondary
            ? "rounded-xl px-4 py-2 font-semibold text-teal-800 ring-1 ring-teal-800/30 hover:bg-teal-50"
            : "rounded-xl bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900"
        }
      >
        {button}
      </button>
    </li>
  );
}

function StoryPanel({
  title,
  content,
  storyTypeLabel,
  writing,
}: {
  title: string;
  content: StoryContent;
  storyTypeLabel: string | undefined;
  writing: boolean;
}) {
  const draft = content.draft;
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!draft) return;
    const text = STORY_PARTS.map((p) => draft.parts[p.id]).filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(`${title}\n\n${text}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the text is still on screen to select.
    }
  }

  return (
    <section
      className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition sm:p-6 lg:sticky lg:top-6 ${
        writing ? "opacity-60" : ""
      }`}
      aria-label="Your story"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Your story</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900" data-testid="story-title">
            {draft ? title : (storyTypeLabel ?? title)}
          </h2>
        </div>
        {draft && (
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-teal-800 ring-1 ring-teal-800/20 hover:bg-teal-50"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {STORY_PARTS.map((part) => {
          const notes = notesForPart(content, part.id);
          const written = draft?.parts[part.id];
          return (
            <div key={part.id} data-testid={`part-${part.id}`}>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <span
                  className={`h-2 w-2 rounded-full ${
                    written ? "bg-teal-600" : notes.length ? "bg-teal-300" : "bg-slate-200"
                  }`}
                />
                {part.label}
              </h3>
              {written ? (
                <p className="mt-1 leading-relaxed text-slate-800">
                  <Highlighted text={written} marks={draft?.untracedNumbers ?? []} />
                </p>
              ) : notes.length ? (
                <ul className="mt-1 flex flex-col gap-1 border-l-2 border-teal-100 pl-3 text-sm text-slate-500">
                  {notes.map((n, i) => (
                    <li key={i} className="line-clamp-3 whitespace-pre-wrap">
                      {n}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 rounded-xl border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-400">
                  Empty
                </p>
              )}
              {part.id === "result" && draft && <NumberCheck untraced={draft.untracedNumbers} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function notesForPart(content: StoryContent, part: StoryPartId): string[] {
  return [
    ...CORE_QUESTIONS.filter((q) => q.part === part).map((q) => content.answers[q.id] ?? ""),
    ...(content.followUps ?? [])
      .filter((f) => (GAP_TO_PART[f.gap] ?? "situation") === part)
      .map((f) => f.answer ?? ""),
  ].filter((n) => n.trim());
}

function NumberCheck({ untraced }: { untraced: string[] }) {
  if (untraced.length === 0) {
    return (
      <p className="mt-2 text-sm font-medium text-teal-800" data-testid="number-check">
        ✓ Every number in this story comes from your answers.
      </p>
    );
  }
  return (
    <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" data-testid="number-check">
      These figures aren&apos;t in your answers: <strong>{untraced.join(", ")}</strong>. If
      they&apos;re real, add them to an answer and rewrite. If not, rewrite to drop them.
    </p>
  );
}

// Marks the untraced figures in a part so the user can see exactly which ones to check.
function Highlighted({ text, marks }: { text: string; marks: string[] }) {
  if (marks.length === 0) return <>{text}</>;
  const escaped = marks.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pieces = text.split(new RegExp(`(${escaped.join("|")})`, "g"));
  return (
    <>
      {pieces.map((piece, i) =>
        marks.includes(piece) ? (
          <mark key={i} className="rounded bg-amber-100 px-0.5 text-amber-900">
            {piece}
          </mark>
        ) : (
          piece
        ),
      )}
    </>
  );
}
