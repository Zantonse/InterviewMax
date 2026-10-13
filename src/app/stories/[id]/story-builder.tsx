"use client";

import Link from "next/link";
import { Fragment, useEffect, useId, useRef, useState, useTransition } from "react";
import {
  builderStage,
  canStrengthen,
  nextCoreQuestion,
  nextFollowUpIndex,
  type StoryContent,
} from "@/lib/stories/content";
import {
  MAX_ANSWER_LENGTH,
  MAX_UPLOAD_BYTES,
  UPLOAD_EXTENSIONS,
  coreQuestionText,
  coreQuestions,
  getStoryType,
  inferredPathQuestion,
  storyParts,
  type StoryPart,
  type StoryType,
} from "@/lib/stories/story-types";
import {
  askFollowUps,
  gradeDraft,
  importLinkedIn,
  importPreparedAnswer,
  inferPath,
  saveAnswer,
  saveFollowUpAnswer,
  writeDraft,
  type BuilderResult,
} from "./actions";
import { EvaluationPanel } from "./evaluation-panel";

type Busy = null | "saving" | "reading" | "inferring" | "probing" | "writing" | "grading";
type Editing = null | { kind: "core"; id: string } | { kind: "followUp"; index: number };

// Where a follow-up's answer shows up in the story panel, by the gap it was aimed at. Gaps that
// match a part id (every "Tell me about yourself" gap does) land in that part.
const GAP_TO_PART: Record<string, string> = {
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
  hasResume = false,
}: {
  storyId: string;
  storyTypeId: string | null;
  initialTitle: string;
  initialContent: StoryContent;
  // Whether the user added a resume on the target jobs page; "Tell me about yourself" reads their
  // career path from it.
  hasResume?: boolean;
}) {
  const storyType = getStoryType(storyTypeId);
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [, startTransition] = useTransition();

  const questions = coreQuestions(storyType);
  const stage = builderStage(content, storyType);

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
        // follow-up, to the next round or straight on to call two.
        const next = builderStage(result.content, storyType);
        const saved = step.busy === "saving" || step.busy === "reading";
        if (saved && canInferPath(result.content)) {
          // Next up is how they got here: read it from their resume or LinkedIn to confirm.
          steps.push({ busy: "inferring", action: () => inferPath(storyId) });
        } else if (saved && next === "probe") {
          steps.push({ busy: "probing", action: () => askFollowUps(storyId) });
        } else if ((saved || step.busy === "probing") && next === "write") {
          steps.push({ busy: "writing", action: () => writeDraft(storyId) });
        } else if (step.busy === "writing") {
          // Every new or rewritten draft is graded straight away.
          steps.push({ busy: "grading", action: () => gradeDraft(storyId) });
        }
      }
      setBusy(null);
    });
  }

  // "Tell me about yourself": whether the path question can be read from a document instead.
  function canInferPath(c: StoryContent) {
    return (
      storyType?.format === "intro" &&
      !c.imported &&
      !c.inferredPath &&
      nextCoreQuestion(c, storyType) === "path" &&
      (hasResume || Boolean(c.linkedin))
    );
  }

  function submitCore(id: string, answer: string) {
    setEditing(null);
    run([{ busy: "saving", action: () => saveAnswer(storyId, id, answer) }]);
  }

  function submitFollowUp(index: number, answer: string) {
    setEditing(null);
    // Answering the last of the extra questions on a drafted story rewrites it to use them.
    const unanswered = (content.followUps ?? []).filter((f) => !f.answer?.trim()).length;
    const rewrite =
      Boolean(content.draft) && unanswered === 1 && !content.followUps?.[index]?.answer;
    run([
      { busy: "saving", action: () => saveFollowUpAnswer(storyId, index, answer) },
      ...(rewrite ? [{ busy: "writing" as const, action: () => writeDraft(storyId) }] : []),
    ]);
  }

  function submitUpload(formData: FormData) {
    setEditing(null);
    run([{ busy: "saving", action: () => importPreparedAnswer(storyId, formData) }]);
  }

  function submitLinkedIn(formData: FormData) {
    setEditing(null);
    run([{ busy: "reading", action: () => importLinkedIn(storyId, formData) }]);
  }

  const currentCore = nextCoreQuestion(content, storyType);
  const currentFollowUp = nextFollowUpIndex(content);
  const coreAnswered = questions.filter((q) => content.answers[q.id]?.trim()).length;
  // With an uploaded answer the remaining scripted questions are skipped.
  const askedCore = questions.filter(
    (q) => content.answers[q.id]?.trim() || (!content.imported && q.id === currentCore),
  );
  const canUpload = storyType?.format === "intro" && stage === "core";

  return (
    <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,26rem)]">
      {/* The conversation */}
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-sm font-bold uppercase tracking-wide text-teal-800">
            {storyType?.label ?? "Your story"}
          </h1>
          <p className="shrink-0 whitespace-nowrap text-sm text-slate-500" data-testid="progress">
            {progressLabel(stage, coreAnswered, questions.length, content)}
          </p>
        </div>

        {storyType?.format === "intro" && (
          <RoleMapCard storyId={storyId} content={content} prominent={canUpload} />
        )}

        {canUpload && (
          <div className="mt-5 flex flex-col gap-3">
            {!content.linkedin && (
              <UploadOption
                testId="upload-linkedin"
                lead="Have a LinkedIn profile?"
                text="On your profile, click More, then Save to PDF, and upload that file here. I'll fill in what it already answers and only ask about the rest."
                accept=".pdf"
                button="Upload profile"
                disabled={busy !== null}
                onUpload={submitLinkedIn}
              />
            )}
            <UploadOption
              testId="upload-prepared"
              lead="Already prepared this answer?"
              text="Upload it as a Word (.docx) or text file and I'll review it instead of asking these questions."
              accept={UPLOAD_EXTENSIONS.join(",")}
              button="Upload and review"
              disabled={busy !== null}
              onUpload={submitUpload}
            />
          </div>
        )}

        <ol className="mt-5 flex flex-col gap-4">
          {content.imported && (
            <li className="flex flex-col gap-2">
              <CoachBubble>Here&apos;s the answer you prepared before.</CoachBubble>
              <div className="flex flex-col items-end gap-1" data-testid="imported-answer">
                <p className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-teal-800 px-4 py-3 text-white">
                  {content.imported.text}
                </p>
                {content.imported.fileName && (
                  <p className="text-xs text-slate-500">From {content.imported.fileName}</p>
                )}
              </div>
            </li>
          )}

          {content.linkedin && (
            <CoachLine>
              I read your LinkedIn profile
              {content.linkedin.prefilled.length > 0
                ? " and filled in what it answers. Edit anything that's off."
                : ", but it didn't answer these questions directly."}
            </CoachLine>
          )}

          {askedCore.map((q) => {
            const answer = content.answers[q.id];
            const isEditing = editing?.kind === "core" && editing.id === q.id;
            const inferred = q.id === "path" ? content.inferredPath : undefined;
            return (
              <Exchange
                key={q.id}
                question={
                  inferred
                    ? inferredPathQuestion(inferred.source)
                    : coreQuestionText(q.id, storyType)
                }
                answer={answer}
                suggested={inferred?.text}
                source={
                  content.roleMap?.seeded?.includes(q.id)
                    ? "From your role map"
                    : content.linkedin?.prefilled.includes(q.id)
                      ? "From your LinkedIn"
                      : inferred
                        ? `Started from your ${inferred.source === "resume" ? "resume" : "LinkedIn"}`
                        : undefined
                }
                isCurrent={q.id === currentCore}
                isEditing={isEditing}
                disabled={busy !== null}
                onEdit={() => setEditing({ kind: "core", id: q.id })}
                onCancel={() => setEditing(null)}
                onSubmit={(text) => submitCore(q.id, text)}
              />
            );
          })}

          {content.followUps?.map((f, index) => {
            if (index > (currentFollowUp ?? Infinity)) return null;
            const isEditing = editing?.kind === "followUp" && editing.index === index;
            const round = f.round ?? 1;
            const opensRound = index === 0 || round !== (content.followUps?.[index - 1].round ?? 1);
            return (
              <Fragment key={index}>
                {opensRound && (
                  <CoachLine>
                    {round === 1
                      ? "Thanks. A few quick follow-ups before I write it up, easiest first:"
                      : "Good. A few more, so the numbers and examples carry it:"}
                  </CoachLine>
                )}
                <Exchange
                  question={f.question}
                  answer={f.answer}
                  isCurrent={index === currentFollowUp}
                  isEditing={isEditing}
                  disabled={busy !== null}
                  onEdit={() => setEditing({ kind: "followUp", index })}
                  onCancel={() => setEditing(null)}
                  onSubmit={(text) => submitFollowUp(index, text)}
                />
              </Fragment>
            );
          })}

          {busy === "reading" && <Thinking>Reading your LinkedIn profile…</Thinking>}
          {busy === "inferring" && (
            <Thinking>
              Reading your path from your {hasResume ? "resume" : "LinkedIn profile"}…
            </Thinking>
          )}
          {!busy && canInferPath(content) && (
            <li>
              <button
                type="button"
                onClick={() => run([{ busy: "inferring", action: () => inferPath(storyId) }])}
                className="text-sm font-medium text-teal-800 hover:underline"
                data-testid="infer-path"
              >
                Read it from my {hasResume ? "resume" : "LinkedIn profile"} instead
              </button>
            </li>
          )}
          {busy === "probing" && <Thinking>Reading your answers…</Thinking>}
          {busy === "writing" && <Thinking>Writing your story from your answers…</Thinking>}

          {!busy && stage === "probe" && (
            <ActionLine
              text={
                content.followUps
                  ? "Thanks. Next I'll check whether anything is still thin and ask a few more if so."
                  : content.imported
                    ? "Your prepared answer is in. Next I'll review it and ask a few follow-ups."
                    : "That's every question. Next I'll look for gaps and ask a few follow-ups."
              }
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
                  : content.nothingMoreToAsk
                    ? "I couldn't find anything more to ask: the answers behind this draft are already strong. Change an answer and I'll look again."
                    : "Your draft is ready, built only from what you told me. Ask me more to make it stronger, as many times as you like, or rewrite it after changing an answer."
              }
              button="Rewrite the story"
              secondary
              onClick={() => run([{ busy: "writing", action: () => writeDraft(storyId) }])}
              extra={
                canStrengthen(content) && !content.nothingMoreToAsk
                  ? {
                      button: "Ask me more to make it stronger",
                      onClick: () =>
                        run([{ busy: "probing", action: () => askFollowUps(storyId) }]),
                    }
                  : undefined
              }
            />
          )}
        </ol>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
      </section>

      {/* The story assembling, and how it grades: stacked in one column on a laptop, side by side
          on a wide screen, where the wrapper steps aside so each is its own sticky column. */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto xl:contents">
        <StoryPanel
          title={title}
          content={content}
          storyType={storyType}
          writing={busy === "writing"}
        />
        <EvaluationPanel
          className="xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto"
          content={content}
          storyType={storyType}
          grading={busy === "grading"}
          disabled={busy !== null}
          onGrade={() => run([{ busy: "grading", action: () => gradeDraft(storyId) }])}
        />
      </div>
    </div>
  );
}

function progressLabel(
  stage: ReturnType<typeof builderStage>,
  coreAnswered: number,
  coreTotal: number,
  content: StoryContent,
) {
  switch (stage) {
    case "core":
      return `Question ${coreAnswered + 1} of ${coreTotal}`;
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
  suggested,
  source,
  isCurrent,
  isEditing,
  disabled,
  onEdit,
  onCancel,
  onSubmit,
}: {
  question: string;
  answer: string | undefined;
  // A proposed answer to confirm or correct, e.g. a career path read from a resume.
  suggested?: string;
  // Where a prefilled answer came from, e.g. "From your LinkedIn".
  source?: string;
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
          initial={isEditing ? (answer ?? "") : (suggested ?? "")}
          disabled={disabled}
          submitLabel={isEditing ? "Save" : suggested ? "That's right" : "Next"}
          onSubmit={onSubmit}
          onCancel={isEditing ? onCancel : undefined}
        />
      ) : answer ? (
        <div className="flex flex-col items-end gap-1">
          <p className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-teal-800 px-4 py-3 text-white">
            {answer}
          </p>
          {source && <p className="text-xs text-slate-500">{source}</p>}
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

// "Tell me about yourself" only: Map my role, for people who find it hard to put their work into
// words. Offered up front while the questions are open; afterwards, a link back to the profile.
function RoleMapCard({
  storyId,
  content,
  prominent,
}: {
  storyId: string;
  content: StoryContent;
  prominent: boolean;
}) {
  const href = `/stories/${storyId}/map`;
  if (content.roleMap?.profile) {
    return (
      <p className="mt-4 text-sm text-slate-600" data-testid="role-map-link">
        Built on your role map.{" "}
        <Link href={href} className="font-medium text-teal-800 hover:underline">
          See your role profile
        </Link>
      </p>
    );
  }
  if (!prominent) {
    return (
      <p className="mt-4 text-sm text-slate-600" data-testid="role-map-link">
        Want words for what you did?{" "}
        <Link href={href} className="font-medium text-teal-800 hover:underline">
          Map my role
        </Link>
      </p>
    );
  }
  return (
    <div
      className="mt-5 flex flex-col items-start gap-3 rounded-2xl bg-teal-800 p-4 text-white"
      data-testid="role-map-card"
    >
      <p>
        <span className="font-semibold">Not sure how to describe your role?</span> Map it first.
        I&apos;ll ask about the work itself, show you the whole function so you can mark your part,
        and hand back a one-page profile that fills in these answers.
      </p>
      <Link
        href={href}
        className="rounded-xl bg-white px-4 py-2 font-semibold text-teal-900 hover:bg-teal-50"
      >
        {content.roleMap ? "Continue mapping my role" : "Map my role"}
      </Link>
    </div>
  );
}

// "Tell me about yourself" only: start from a file instead of typing every answer.
function UploadOption({
  testId,
  lead,
  text,
  accept,
  button,
  disabled,
  onUpload,
}: {
  testId: string;
  lead: string;
  text: string;
  accept: string;
  button: string;
  disabled: boolean;
  onUpload: (formData: FormData) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-dashed border-teal-200 bg-teal-50/50 p-4"
      data-testid={testId}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const file = formData.get("file");
        if (!(file instanceof File) || !file.name) return setError("Choose a file first.");
        if (file.size > MAX_UPLOAD_BYTES) return setError("Keep the file under 3 MB.");
        setError(null);
        onUpload(formData);
      }}
    >
      <label htmlFor={fieldId} className="text-sm text-slate-700">
        <span className="font-semibold text-slate-900">{lead}</span> {text}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={fieldId}
          name="file"
          type="file"
          accept={accept}
          disabled={disabled}
          className="min-w-0 flex-1 text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:font-medium file:text-teal-800 file:ring-1 file:ring-teal-800/20"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-xl bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
        >
          {button}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
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
  extra,
}: {
  text: string;
  button: string;
  secondary?: boolean;
  onClick: () => void;
  // A second, primary action shown first, e.g. another round of questions on a drafted story.
  extra?: { button: string; onClick: () => void };
}) {
  return (
    <li className="flex flex-col items-start gap-3 rounded-2xl bg-slate-50 p-4">
      <p className="text-slate-700">{text}</p>
      <div className="flex flex-wrap gap-2">
        {extra && (
          <button
            type="button"
            onClick={extra.onClick}
            className="rounded-xl bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900"
          >
            {extra.button}
          </button>
        )}
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
      </div>
    </li>
  );
}

function StoryPanel({
  title,
  content,
  storyType,
  writing,
}: {
  title: string;
  content: StoryContent;
  storyType: StoryType | undefined;
  writing: boolean;
}) {
  const draft = content.draft;
  const parts = storyParts(storyType);
  const storyTypeLabel = storyType?.label;
  const [copied, setCopied] = useState(false);
  // A written story reads as one script to say aloud; the parts view is for checking what went where.
  const [showParts, setShowParts] = useState(false);
  const paragraphs = draft ? parts.map((p) => draft.parts[p.id]).filter(Boolean) : [];
  const words = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  // At an interview pace of about 150 words a minute.
  const seconds = Math.round(((words / 150) * 60) / 5) * 5;

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(paragraphs.join("\n\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the text is still on screen to select.
    }
  }

  return (
    <section
      className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition sm:p-6 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto ${
        writing ? "opacity-60" : ""
      }`}
      aria-label="Your story"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Your story</p>
          <h2
            className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900"
            data-testid="story-title"
          >
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

      {draft && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <span data-testid="script-length">
            {words} words, about {seconds < 60 ? `${seconds} seconds` : formatMinutes(seconds)}{" "}
            spoken
          </span>
          <button
            type="button"
            onClick={() => setShowParts((v) => !v)}
            className="font-medium text-teal-800 hover:underline"
          >
            {showParts ? "Show as a script" : "Show by part"}
          </button>
        </div>
      )}

      {draft && !showParts ? (
        <div className="mt-5" data-testid="story-script">
          <div className="flex flex-col gap-4 text-lg leading-relaxed text-slate-800">
            {paragraphs.map((text, i) => (
              <p key={i}>
                <Highlighted text={text} marks={draft.untracedNumbers} />
              </p>
            ))}
          </div>
          <NumberCheck untraced={draft.untracedNumbers} />
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {parts.map((part) => {
            const notes = notesForPart(content, storyType, parts, part);
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
                {NUMBER_PARTS.has(part.id) && draft && (
                  <NumberCheck untraced={draft.untracedNumbers} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatMinutes(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} sec` : `${m} min`;
}

// The part that carries the story's number, where the number check is shown.
const NUMBER_PARTS = new Set(["result", "highlight"]);

function notesForPart(
  content: StoryContent,
  storyType: StoryType | undefined,
  parts: readonly StoryPart[],
  part: StoryPart,
): string[] {
  const partFor = (gap: string) =>
    parts.find((p) => p.id === gap)?.id ?? GAP_TO_PART[gap] ?? parts[0].id;
  return [
    // An uploaded answer isn't split by part until the story is written; show it at the top.
    part.id === parts[0].id ? (content.imported?.text ?? "") : "",
    ...coreQuestions(storyType)
      .filter((q) => q.part === part.id)
      .map((q) => content.answers[q.id] ?? ""),
    ...(content.followUps ?? [])
      .filter((f) => partFor(f.gap) === part.id)
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
    <p
      className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
      data-testid="number-check"
    >
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
