"use client";

import Link from "next/link";
import { Fragment, useEffect, useId, useRef, useState, useTransition } from "react";
import { CopyButton } from "@/components/copy-button";
import { MicButton } from "@/components/mic-button";
import { suggestRoleMap } from "@/lib/roles/role-map";
import {
  builderStage,
  canStrengthen,
  gradeIsCurrent,
  isRoughDraft,
  nextCoreQuestion,
  nextFollowUpIndex,
  pendingFollowUps,
  writesRoughDraft,
  type StoryContent,
} from "@/lib/stories/content";
import {
  DEFAULT_WHERE_TO_LOOK,
  ESTIMATE_STARTERS,
  asksForNumber,
  questionHelp,
  type QuestionHelp,
} from "@/lib/stories/help";
import {
  MAX_ANSWER_LENGTH,
  MAX_UPLOAD_BYTES,
  UPLOAD_EXTENSIONS,
  answerableQuestions,
  coreQuestionText,
  coreQuestions,
  getStoryType,
  inferredPathQuestion,
  storyParts,
  type StoryPart,
  type StoryType,
} from "@/lib/stories/story-types";
import {
  addVividDetail,
  askFollowUps,
  coachDraft,
  gradeDraft,
  pickHook,
  importLinkedIn,
  importPreparedAnswer,
  inferPath,
  saveAnswer,
  saveFollowUpAnswer,
  skipFollowUp,
  skipFollowUps,
  writeDraft,
  type BuilderResult,
} from "./actions";
import { createStory } from "@/app/stories/new/actions";
import { type BuilderTargets, nextRoleHint, openingHint } from "@/lib/stories/targets";
import { appendSpoken } from "@/lib/voice/text";
import { EvaluationPanel } from "./evaluation-panel";
import { TellingPanel } from "./telling-panel";
import { AiNotice } from "@/components/ai-notice";

type Busy =
  | null
  | "saving"
  | "reading"
  | "inferring"
  | "probing"
  | "writing"
  | "grading"
  | "coaching";
type Editing = null | { kind: "core"; id: string } | { kind: "followUp"; index: number };

// Where a follow-up's answer shows up in the story panel, by the gap it was aimed at. Gaps that
// match a part id (every "Tell me about yourself" gap does) land in that part.
const GAP_TO_PART: Record<string, string> = {
  situation: "situation",
  context: "situation",
  ownership: "role",
  role: "role",
  actions: "actions",
  obstacle: "actions",
  decision: "actions",
  result: "result",
  reflection: "reflection",
  // The vivid detail asked for in "How to tell it".
  detail: "actions",
};

// A moment from the story finder that fits this story type, offered as a memory jogger.
export type JoggerMoment = { moment: string; quote: string; sourceLabel: string };

export function StoryBuilder({
  storyId,
  newStory,
  storyTypeId,
  initialTitle,
  initialContent,
  hasResume = false,
  moments = [],
  targets,
  afterStory,
  nextUp,
  menu,
  beside,
}: {
  // Null for a new story that isn't saved yet: the first action creates it from newStory.
  storyId: string | null;
  newStory?: { storyType: string; asked?: string };
  storyTypeId: string | null;
  initialTitle: string;
  initialContent: StoryContent;
  // Whether the user added a resume on the target jobs page; "Tell me about yourself" reads their
  // career path from it.
  hasResume?: boolean;
  // Story finder moments for this story type, shown as joggers on the opening question.
  moments?: JoggerMoment[];
  // What they're preparing for (target jobs, the role they want): the first question gets a hint
  // so they pick a story that fits.
  targets?: BuilderTargets;
  // Shown under the story on the Story & score view.
  afterStory?: React.ReactNode;
  // What to do next, shown under the story once it's written.
  nextUp?: React.ReactNode;
  // Story-level actions, such as delete, in the ⋯ menu.
  menu?: React.ReactNode;
  // Shown beside the chat on the Build view, under the answer checklist.
  beside?: React.ReactNode;
}) {
  const storyType = getStoryType(storyTypeId);
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [busy, setBusy] = useState<Busy>(null);
  // The saved story's id, read when each action runs (a new story gets one with its first answer).
  const idRef = useRef(storyId);
  const sid = (): string => idRef.current ?? "";
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [, startTransition] = useTransition();
  // Text a memory jogger adds to the answer box; `n` makes each tap count.
  const [insert, setInsert] = useState<{ text: string; n: number } | undefined>();
  // Build is the chat; Story & score is the written story beside its evaluation.
  const [view, setView] = useState<View>(
    initialContent.draft && nextFollowUpIndex(initialContent) === undefined ? "story" : "build",
  );

  const questions = coreQuestions(storyType);
  const stage = builderStage(content, storyType);

  // Runs a chain of actions, applying each result. Stops at the first error.
  function run(steps: { busy: Exclude<Busy, null>; action: () => Promise<BuilderResult> }[]) {
    setError(null);
    startTransition(async () => {
      if (!idRef.current && newStory) {
        setBusy("saving");
        const created = await createStory(newStory.storyType, newStory.asked);
        if (!created.ok) {
          setError(created.error);
          setBusy(null);
          return;
        }
        idRef.current = created.id;
        // The address becomes the saved story's, so a reload or the back button finds it.
        window.history.replaceState(null, "", `/stories/${created.id}`);
      }
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        setBusy(step.busy);
        const result = await step.action();
        if (!result.ok) {
          setError(result.error);
          break;
        }
        setContent(result.content);
        setTitle(result.title);
        const next = builderStage(result.content, storyType);
        // A finished draft is shown with its score; a rough one stays beside the follow-ups.
        if (step.busy === "writing" && next !== "probe") setView("story");
        if (step.busy === "probing" && nextFollowUpIndex(result.content) !== undefined) {
          setView("build");
        }
        // Only the last step queued picks what runs next.
        if (i < steps.length - 1) continue;
        // After the last scripted answer, go straight on to call one; after the last
        // follow-up, to the next round or straight on to call two. A behavioral story is
        // written rough first, then asked about.
        const saved = step.busy === "saving" || step.busy === "reading";
        if (saved && canInferPath(result.content)) {
          // Next up is how they got here: read it from their resume or LinkedIn to confirm.
          steps.push({ busy: "inferring", action: () => inferPath(sid()) });
        } else if (saved && writesRoughDraft(result.content, storyType)) {
          steps.push({ busy: "writing", action: () => writeDraft(sid()) });
        } else if ((saved || step.busy === "writing") && next === "probe") {
          steps.push({ busy: "probing", action: () => askFollowUps(sid()) });
        } else if ((saved || step.busy === "probing") && next === "write") {
          steps.push({ busy: "writing", action: () => writeDraft(sid()) });
        } else if (
          step.busy === "writing" ||
          (next === "drafted" && !gradeIsCurrent(result.content) && step.busy !== "grading")
        ) {
          // Every finished draft is graded straight away, including a rough one the user kept.
          steps.push({ busy: "grading", action: () => gradeDraft(sid()) });
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
    run([{ busy: "saving", action: () => saveAnswer(sid(), id, answer) }]);
  }

  function submitFollowUp(index: number, answer: string) {
    setEditing(null);
    // Answering the last open question on a drafted story rewrites it to use the answers.
    const rewrite =
      Boolean(content.draft) &&
      pendingFollowUps(content) === 1 &&
      !content.followUps?.[index]?.answer;
    run([
      { busy: "saving", action: () => saveFollowUpAnswer(sid(), index, answer) },
      ...(rewrite ? [{ busy: "writing" as const, action: () => writeDraft(sid()) }] : []),
    ]);
  }

  // Drops the unanswered follow-ups. Without a draft, the chain goes on to write it; on a drafted
  // story, it's rewritten only if this round's answers added something.
  function skipRest() {
    setEditing(null);
    const round = Math.max(0, ...(content.followUps ?? []).map((f) => f.round ?? 1));
    const addedThisRound = (content.followUps ?? []).some(
      (f) => (f.round ?? 1) === round && f.answer?.trim(),
    );
    run([
      { busy: "saving", action: () => skipFollowUps(sid()) },
      ...(content.draft && addedThisRound
        ? [{ busy: "writing" as const, action: () => writeDraft(sid()) }]
        : []),
    ]);
  }

  // "I don't know this": passes on one question. On the last open one, a drafted story is
  // rewritten with what this round did add (or just graded, if nothing was added).
  function skipOne(index: number) {
    setEditing(null);
    const round = content.followUps?.[index]?.round ?? 1;
    const addedThisRound = (content.followUps ?? []).some(
      (f) => (f.round ?? 1) === round && f.answer?.trim(),
    );
    const rewrite = Boolean(content.draft) && pendingFollowUps(content) === 1 && addedThisRound;
    run([
      { busy: "saving", action: () => skipFollowUp(sid(), index) },
      ...(rewrite ? [{ busy: "writing" as const, action: () => writeDraft(sid()) }] : []),
    ]);
  }

  function strengthen() {
    run([{ busy: "probing", action: () => askFollowUps(sid()) }]);
  }

  function submitUpload(formData: FormData) {
    setEditing(null);
    run([{ busy: "saving", action: () => importPreparedAnswer(sid(), formData) }]);
  }

  function submitLinkedIn(formData: FormData) {
    setEditing(null);
    run([{ busy: "reading", action: () => importLinkedIn(sid(), formData) }]);
  }

  const currentCore = nextCoreQuestion(content, storyType);
  const currentFollowUp = nextFollowUpIndex(content);
  const coreAnswered = questions.filter((q) => content.answers[q.id]?.trim()).length;
  // With an uploaded answer the remaining scripted questions are skipped. Answers to the old
  // scripted questions (stories started before "tell it your way") are still shown.
  const askedCore = answerableQuestions(storyType).filter(
    (q) => content.answers[q.id]?.trim() || (!content.imported && q.id === currentCore),
  );
  const canUpload = storyType?.format === "intro" && stage === "core";
  const inferredNow = currentCore === "path" ? content.inferredPath : undefined;
  // A moment picked in the story finder fills in the first answer, for the user to make their own.
  const seed = content.seed && storyType?.format !== "intro" ? content.seed : undefined;
  const seedNow = currentCore === "start" ? seed : undefined;
  const hints: Record<string, string | undefined> = {
    // Started from a real question, the question itself says what to pick.
    start: seed ? seedHint(seed) : content.asked ? undefined : openingHint(targets, storyType),
    next: storyType?.format === "intro" ? nextRoleHint(targets) : undefined,
  };

  // The chat keeps its newest message in view, unless an earlier answer is open for editing.
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (editing || view !== "build") return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [content, busy, editing, view]);

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          {storyType?.label ?? "Your story"}
        </h1>
        <p className="whitespace-nowrap text-sm text-slate-500" data-testid="progress">
          {progressLabel(stage, coreAnswered, questions.length, content)}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Story views"
            className="flex rounded-full bg-slate-200/70 p-1 text-sm font-semibold"
          >
            {VIEWS.map((v, i) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                onClick={() => setView(v.id)}
                className={`rounded-full px-3.5 py-1.5 transition ${
                  view === v.id
                    ? "bg-white text-ink-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                data-testid={`tab-${v.id}`}
              >
                {i + 1} · {v.label}
              </button>
            ))}
          </div>
          {menu && (
            <details className="relative" data-testid="story-menu">
              <summary
                aria-label="More options"
                className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl text-lg leading-none text-slate-600 ring-1 ring-slate-300 hover:bg-white [&::-webkit-details-marker]:hidden"
              >
                ⋯
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-72 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-black/10">
                {menu}
              </div>
            </details>
          )}
        </div>
      </div>

      {view === "build" ? (
        <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* The conversation: its own scrolling pane, with the answer box pinned under it. */}
          <section
            className="flex h-[calc(100dvh-12rem)] min-h-[26rem] flex-col rounded-3xl bg-white shadow-sm ring-1 ring-black/5"
            aria-label="Conversation"
          >
            <ol
              ref={listRef}
              className="flex flex-1 flex-col gap-4 overflow-y-scroll overscroll-contain p-5 sm:p-6"
              data-testid="chat"
            >
              {!content.imported && !content.linkedin && (
                <li className="text-sm text-slate-500" data-testid="builder-intro">
                  {storyType?.format === "intro"
                    ? `How this works: answer ${questions.length} short questions in plain notes, typed or spoken. Then I'll ask a few follow-ups where it's thin and write your answer from your words, ready to shape for each target job.`
                    : "How this works: tell me what happened, your way. Messy notes or a minute of talking is plenty. I'll write a rough draft straight away, then ask a few questions about what's missing to make it stronger."}
                </li>
              )}

              {content.imported && (
                <li className="flex flex-col gap-2">
                  <CoachBubble>Here&apos;s the answer you prepared before.</CoachBubble>
                  <div className="flex flex-col items-end gap-1" data-testid="imported-answer">
                    <p className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink-800 px-4 py-3 text-white">
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
                const inferred = q.id === "path" ? content.inferredPath : undefined;
                return (
                  <Exchange
                    key={q.id}
                    question={
                      inferred
                        ? inferredPathQuestion(inferred.source)
                        : coreQuestionText(q.id, storyType, content.asked)
                    }
                    answer={content.answers[q.id]}
                    hint={content.answers[q.id]?.trim() ? undefined : hints[q.id]}
                    help={
                      content.answers[q.id]?.trim()
                        ? undefined
                        : questionHelp(q.id === "start" && storyType?.format !== "intro" ? "telling" : q.part)
                    }
                    joggers={
                      q.id === "start" && !content.answers[q.id]?.trim() && !seed ? (
                        <Joggers
                          storyType={storyType}
                          moments={moments}
                          disabled={busy !== null}
                          onPick={(text) => setInsert((n) => ({ text, n: (n?.n ?? 0) + 1 }))}
                        />
                      ) : undefined
                    }
                    source={
                      content.roleMap?.seeded?.includes(q.id)
                        ? "From your role map"
                        : content.linkedin?.prefilled.includes(q.id)
                          ? "From your LinkedIn"
                          : inferred
                            ? `Started from your ${inferred.source === "resume" ? "resume" : "LinkedIn"}`
                            : undefined
                    }
                    isEditing={editing?.kind === "core" && editing.id === q.id}
                    disabled={busy !== null}
                    onEdit={() => setEditing({ kind: "core", id: q.id })}
                    onCancel={() => setEditing(null)}
                    onSubmit={(text) => submitCore(q.id, text)}
                  />
                );
              })}

              {content.followUps?.map((f, index) => {
                if (index > (currentFollowUp ?? Infinity)) return null;
                const round = f.round ?? 1;
                const opensRound =
                  index === 0 || round !== (content.followUps?.[index - 1].round ?? 1);
                const fromPractice = f.source === "practice";
                const opensPractice =
                  fromPractice && content.followUps?.[index - 1]?.source !== "practice";
                return (
                  <Fragment key={index}>
                    {opensPractice && <CoachLine>Added from your practice answers:</CoachLine>}
                    {opensRound && !fromPractice && (
                      <CoachLine>
                        {round === 1
                          ? content.draft && storyType?.format !== "intro"
                            ? "I've written a rough draft. A few quick questions to make it stronger, easiest first:"
                            : "Thanks. A few quick follow-ups, easiest first:"
                          : "Good. A few more, so the numbers and examples carry it:"}
                      </CoachLine>
                    )}
                    <Exchange
                      question={f.question}
                      answer={f.answer}
                      skipped={f.skipped && !f.answer?.trim()}
                      improves={
                        !fromPractice && content.draft ? partLabelForGap(f.gap, storyType) : undefined
                      }
                      help={index === currentFollowUp ? questionHelp(f.gap) : undefined}
                      joggers={
                        index === currentFollowUp && f.options?.length ? (
                          <TapOptions
                            options={f.options}
                            disabled={busy !== null}
                            onPick={(text) => setInsert((n) => ({ text, n: (n?.n ?? 0) + 1 }))}
                          />
                        ) : undefined
                      }
                      onDontKnow={
                        index === currentFollowUp && !fromPractice
                          ? () => skipOne(index)
                          : undefined
                      }
                      onEstimate={
                        index === currentFollowUp && !fromPractice && asksForNumber(f.question, f.gap)
                          ? (text) => setInsert((n) => ({ text, n: (n?.n ?? 0) + 1 }))
                          : undefined
                      }
                      isEditing={editing?.kind === "followUp" && editing.index === index}
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
              {busy === "probing" && <Thinking>Reading your answers…</Thinking>}
              {busy === "writing" && (
                <Thinking>
                  {writesRoughDraft(content, storyType)
                    ? "Writing a rough draft from what you told me…"
                    : "Writing your story from your answers…"}
                </Thinking>
              )}
              {busy === "grading" && <Thinking>Grading your story…</Thinking>}
            </ol>

            <div className="border-t border-slate-100 p-4">
              {error && (
                <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </p>
              )}
              {currentCore && !content.imported ? (
                <>
                  {!busy && canInferPath(content) && (
                    <button
                      type="button"
                      onClick={() => run([{ busy: "inferring", action: () => inferPath(sid()) }])}
                      className="mb-2 text-sm font-medium text-ink-800 hover:underline"
                      data-testid="infer-path"
                    >
                      Read it from my {hasResume ? "resume" : "LinkedIn profile"} instead
                    </button>
                  )}
                  <Composer
                    key={`core-${currentCore}-${inferredNow ? "inferred" : seedNow ? "seed" : "blank"}`}
                    initial={inferredNow?.text ?? (seedNow ? `${seedNow.moment}. ` : "")}
                    insert={insert}
                    rows={currentCore === "start" && storyType?.format !== "intro" ? 6 : 3}
                    disabled={busy !== null}
                    submitLabel="Next"
                    onSubmit={(text) => submitCore(currentCore, text)}
                  />
                </>
              ) : currentFollowUp !== undefined ? (
                <Composer
                  key={`follow-up-${currentFollowUp}`}
                  initial=""
                  insert={insert}
                  disabled={busy !== null}
                  submitLabel="Next"
                  onSubmit={(text) => submitFollowUp(currentFollowUp, text)}
                  onSkip={skipRest}
                  skipLabel={content.draft ? "Skip the rest" : "Skip the rest and write it"}
                />
              ) : busy ? null : stage === "probe" ? (
                <ActionLine
                  text={
                    content.followUps
                      ? "Next I'll check whether anything is still thin."
                      : content.imported
                        ? "Your prepared answer is in. Next I'll look for gaps."
                        : "That's every question. Next I'll look for gaps."
                  }
                  button="Get follow-up questions"
                  onClick={() => run([{ busy: "probing", action: () => askFollowUps(sid()) }])}
                />
              ) : stage === "write" ? (
                <ActionLine
                  text="That's everything I need."
                  button="Write my story"
                  onClick={() => run([{ busy: "writing", action: () => writeDraft(sid()) }])}
                />
              ) : stage === "drafted" ? (
                <ActionLine
                  text="Your story is written."
                  button="See story & score"
                  onClick={() => setView("story")}
                  extra={
                    canStrengthen(content) && !content.nothingMoreToAsk
                      ? { button: "Ask me more to make it stronger", onClick: strengthen }
                      : undefined
                  }
                  secondary
                />
              ) : null}
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            {storyType?.format === "intro" ? (
              <AnswerChecklist
                content={content}
                storyType={storyType}
                currentCore={currentCore}
                onShowStory={() => setView("story")}
              />
            ) : (
              <DraftSoFar
                content={content}
                storyType={storyType}
                writing={busy === "writing"}
                onShowStory={() => setView("story")}
              />
            )}
            {beside}
            {storyType?.format === "intro" && (canUpload || content.roleMap) && (
              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <RoleMapCard
                  storyId={storyId ?? ""}
                  content={content}
                  prominent={
                    canUpload && suggestRoleMap(content.answers[questions[0]?.id], content.roleMap)
                  }
                />
                {canUpload && (
                  <details className="group mt-3" data-testid="start-from-file">
                    <summary className="cursor-pointer text-sm text-slate-600">
                      Have a LinkedIn PDF or a prepared answer?{" "}
                      <span className="font-medium text-ink-800 group-open:hidden">
                        Start from a file
                      </span>
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                      {!content.linkedin && (
                        <UploadOption
                          testId="upload-linkedin"
                          lead="LinkedIn profile:"
                          text="click More, then Save to PDF. I'll fill in what it answers."
                          accept=".pdf"
                          button="Upload profile"
                          disabled={busy !== null}
                          onUpload={submitLinkedIn}
                        />
                      )}
                      <UploadOption
                        testId="upload-prepared"
                        lead="Prepared answer:"
                        text="a Word (.docx) or text file. I'll review it instead of asking."
                        accept={UPLOAD_EXTENSIONS.join(",")}
                        button="Upload and review"
                        disabled={busy !== null}
                        onUpload={submitUpload}
                      />
                      <AiNotice purpose="fill in and review your answers" />
                    </div>
                  </details>
                )}
              </section>
            )}
          </aside>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <StoryPanel
              title={title}
              content={content}
              storyType={storyType}
              writing={busy === "writing"}
            >
              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </p>
              )}
              {content.draft ? (
                <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5">
                  {content.nothingMoreToAsk && (
                    <p className="text-sm text-slate-600">
                      I couldn&apos;t find anything more to ask. Change an answer and I&apos;ll look
                      again.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {canStrengthen(content) && !content.nothingMoreToAsk && (
                      <button
                        type="button"
                        onClick={strengthen}
                        disabled={busy !== null}
                        className="rounded-xl bg-ink-800 px-4 py-2 font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
                      >
                        Ask me more to make it stronger
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => run([{ busy: "writing", action: () => writeDraft(sid()) }])}
                      disabled={busy !== null}
                      className="rounded-xl px-4 py-2 font-semibold text-ink-800 ring-1 ring-ink-800/30 hover:bg-ink-50 disabled:opacity-50"
                    >
                      {busy === "writing" ? "Rewriting…" : "Rewrite"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={() => setView("build")}
                    className="rounded-xl bg-ink-800 px-4 py-2 font-semibold text-white hover:bg-ink-900"
                  >
                    Answer the questions
                  </button>
                </div>
              )}
            </StoryPanel>
            <TellingPanel
              content={content}
              storyType={storyType}
              coaching={busy === "coaching"}
              disabled={busy !== null}
              onCoach={() => run([{ busy: "coaching", action: () => coachDraft(sid()) }])}
              onPickHook={(i) => run([{ busy: "saving", action: () => pickHook(sid(), i) }])}
              onAddDetail={(answer) =>
                run([
                  { busy: "saving", action: () => addVividDetail(sid(), answer) },
                  { busy: "coaching", action: () => coachDraft(sid()) },
                ])
              }
            />
            {content.draft && nextUp}
            {afterStory}
          </div>
          <EvaluationPanel
            className="lg:sticky lg:top-6"
            content={content}
            storyType={storyType}
            grading={busy === "grading"}
            disabled={busy !== null}
            onGrade={() => run([{ busy: "grading", action: () => gradeDraft(sid()) }])}
          />
        </div>
      )}
    </>
  );
}

const VIEWS = [
  { id: "build", label: "Build" },
  { id: "story", label: "Story & score" },
] as const;

type View = (typeof VIEWS)[number]["id"];

// Beside the chat: which parts of the story have answers so far.
function AnswerChecklist({
  content,
  storyType,
  currentCore,
  onShowStory,
}: {
  content: StoryContent;
  storyType: StoryType | undefined;
  currentCore: string | undefined;
  onShowStory: () => void;
}) {
  const questions = coreQuestions(storyType);
  const followUps = content.followUps ?? [];
  const followUpsAnswered = followUps.filter((f) => f.answer?.trim()).length;
  return (
    <section
      className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"
      data-testid="answer-checklist"
    >
      <h2 className="text-xs font-bold uppercase tracking-wide text-ink-800">
        Your answers so far
      </h2>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {storyParts(storyType).map((part) => {
          const asked = questions.filter((q) => q.part === part.id);
          if (asked.length === 0) return null;
          const done =
            Boolean(content.imported) || asked.every((q) => content.answers[q.id]?.trim());
          const current = asked.some((q) => q.id === currentCore);
          return (
            <li key={part.id} className="flex items-center gap-2">
              <span
                className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                  done
                    ? "border-ink-800 bg-ink-800"
                    : current
                      ? "border-ink-800"
                      : "border-slate-300"
                }`}
              />
              <span className={done || current ? "text-slate-900" : "text-slate-500"}>
                {part.label}
              </span>
            </li>
          );
        })}
      </ul>
      {followUps.length > 0 && (
        <p className="mt-3 text-sm text-slate-600">
          Follow-ups: {followUpsAnswered} of {followUps.length} answered
        </p>
      )}
      <p className="mt-4 text-sm text-slate-500">
        {content.draft ? (
          <button
            type="button"
            onClick={onShowStory}
            className="font-medium text-ink-800 hover:underline"
          >
            See your story and its score →
          </button>
        ) : (
          "When the questions are done, I'll write your story and show it with its score."
        )}
      </p>
    </section>
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
      return coreTotal === 1 ? "Tell it your way" : `Question ${coreAnswered + 1} of ${coreTotal}`;
    case "probe":
      return "Questions done";
    case "follow_ups": {
      const total = content.followUps?.length ?? 0;
      const label = `Follow-up ${(nextFollowUpIndex(content) ?? 0) + 1} of ${total}`;
      return content.draft ? `Rough draft · ${label}` : label;
    }
    case "write":
      return "Ready to write";
    case "drafted":
      return "Draft written";
  }
}

function seedHint(seed: NonNullable<StoryContent["seed"]>): string {
  const quote = seed.quote.replace(/[.;,\s]+$/, "");
  const from = quote ? `From ${seed.sourceLabel || "your resume"}: "${quote}". ` : "";
  return `${from}I've started it with this moment${seed.question ? `, ${seed.question.replace(/\?$/, "")}` : ""}. Make it your own: where you were, your role and what was going on.`;
}

// Under the current question: a made-up example of a strong answer, and for follow-ups, "I don't
// know this" with where to look and a way to skip it.
function QuestionHelpRow({
  help,
  disabled,
  onDontKnow,
  onEstimate,
}: {
  help?: QuestionHelp;
  disabled: boolean;
  onDontKnow?: () => void;
  // Set when the question asks for a number: starts the answer as a labelled estimate.
  onEstimate?: (text: string) => void;
}) {
  const [open, setOpen] = useState<null | "example" | "unsure">(null);
  const toggle = (which: "example" | "unsure") => setOpen((o) => (o === which ? null : which));
  // The chat scrolls on its own; bring what just opened into view.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);
  return (
    <div ref={ref} className="flex max-w-[90%] flex-col gap-2 pl-1" data-testid="question-help">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {help?.example && (
          <button
            type="button"
            onClick={() => toggle("example")}
            aria-expanded={open === "example"}
            className="font-medium text-ink-800 hover:underline"
            data-testid="show-example"
          >
            Show me a good answer
          </button>
        )}
        {onDontKnow && (
          <button
            type="button"
            onClick={() => toggle("unsure")}
            aria-expanded={open === "unsure"}
            className="font-medium text-ink-800 hover:underline"
            data-testid="dont-know"
          >
            {onEstimate ? "I don't remember the number" : "I don't know this"}
          </button>
        )}
      </div>
      {open === "example" && help?.example && (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
          <span className="font-semibold text-slate-900">An example, not your facts: </span>
          {help.example}
        </p>
      )}
      {open === "unsure" && onDontKnow && (
        <div className="flex flex-col items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
          {onEstimate ? (
            <>
              <p>
                No need for the exact figure. A rough estimate works in an interview, as long as
                you say it&apos;s an estimate. Tap one to start, then fill in your best guess:
              </p>
              <div className="flex flex-wrap gap-2" data-testid="estimate-starters">
                {ESTIMATE_STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onEstimate(`${starter} `);
                      setOpen(null);
                    }}
                    className="rounded-full bg-white px-3 py-1.5 text-left text-sm text-slate-700 ring-1 ring-slate-300 hover:bg-ink-50 hover:ring-ink-800/30 disabled:opacity-50"
                  >
                    {starter}
                  </button>
                ))}
              </div>
              <p>
                Want the real figure later? Check a dashboard, a performance review or an old
                email. Or skip it and I&apos;ll leave it out.
              </p>
            </>
          ) : (
            <>
              <p>{help?.whereToLook ?? DEFAULT_WHERE_TO_LOOK}</p>
              <p>
                A rough answer or a labelled estimate is fine. Or skip it and I&apos;ll leave it out.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={onDontKnow}
            disabled={disabled}
            className="rounded-xl px-3 py-1.5 font-medium text-ink-800 ring-1 ring-ink-800/30 hover:bg-white disabled:opacity-50"
            data-testid="skip-one"
          >
            Skip this question
          </button>
        </div>
      )}
    </div>
  );
}

// Under the opening question of a behavioral story: a few kinds of moment to jog their memory, and
// moments the story finder read from their resume or LinkedIn. A tap starts the answer with it.
function Joggers({
  storyType,
  moments,
  disabled,
  onPick,
}: {
  storyType: StoryType | undefined;
  moments: JoggerMoment[];
  disabled: boolean;
  onPick: (text: string) => void;
}) {
  const general: readonly string[] = storyType?.joggers ?? [];
  if (general.length === 0 && moments.length === 0) return null;
  const chip =
    "rounded-full bg-white px-3 py-1.5 text-left text-sm text-slate-700 ring-1 ring-slate-300 hover:bg-ink-50 hover:ring-ink-800/30 disabled:opacity-50";
  return (
    <div className="flex max-w-[90%] flex-col gap-2 pl-1" data-testid="joggers">
      {moments.length > 0 && (
        <>
          <p className="text-sm text-slate-600">
            From {moments[0].sourceLabel || "your resume"}, one of these might fit:
          </p>
          <div className="flex flex-wrap gap-2">
            {moments.map((m) => (
              <button
                key={m.moment}
                type="button"
                disabled={disabled}
                onClick={() => onPick(`${m.moment}. `)}
                className={chip}
                title={m.quote ? `"${m.quote}"` : undefined}
              >
                {m.moment}
              </button>
            ))}
          </div>
        </>
      )}
      {general.length > 0 && (
        <>
          <p className="text-sm text-slate-600">
            {moments.length > 0 ? "Or think of:" : "Stuck on which one? Think of:"}
          </p>
          <div className="flex flex-wrap gap-2">
            {general.map((j) => (
              <button
                key={j}
                type="button"
                disabled={disabled}
                onClick={() => onPick(`${j}: `)}
                className={chip}
              >
                {j}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Under a follow-up about a kind of thing (their part, the stakes, the kind of result): the coach's
// starters. A tap puts one in the answer box to finish in their own words.
function TapOptions({
  options,
  disabled,
  onPick,
}: {
  options: string[];
  disabled: boolean;
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex max-w-[90%] flex-col gap-2 pl-1" data-testid="tap-options">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            disabled={disabled}
            onClick={() => onPick(`${o}. `)}
            className="rounded-full bg-white px-3 py-1.5 text-left text-sm text-slate-700 ring-1 ring-slate-300 hover:bg-ink-50 hover:ring-ink-800/30 disabled:opacity-50"
          >
            {o}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">Tap one to start, then add a sentence in your words.</p>
    </div>
  );
}

// Beside the chat for a behavioral story: how it works until there's a draft, then the rough draft
// itself, with the part the current question improves marked.
function DraftSoFar({
  content,
  storyType,
  writing,
  onShowStory,
}: {
  content: StoryContent;
  storyType: StoryType | undefined;
  writing: boolean;
  onShowStory: () => void;
}) {
  const draft = content.draft;
  if (!draft) {
    const told = Boolean(content.answers.start?.trim());
    const steps = [
      "Tell it your way: notes or talking",
      "I write a rough draft",
      "A few questions to make it stronger",
      "Your story, with its score",
    ];
    const current = writing ? 1 : told ? 2 : 0;
    return (
      <section
        className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"
        data-testid="draft-so-far"
      >
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-800">How this works</h2>
        <ol className="mt-3 flex flex-col gap-2 text-sm">
          {steps.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span
                className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                  i < current
                    ? "border-ink-800 bg-ink-800"
                    : i === current
                      ? "border-ink-800"
                      : "border-slate-300"
                }`}
              />
              <span className={i <= current ? "text-slate-900" : "text-slate-500"}>{step}</span>
            </li>
          ))}
        </ol>
      </section>
    );
  }
  const rough = isRoughDraft(content);
  const current = nextFollowUpIndex(content);
  const gap = current !== undefined ? content.followUps?.[current]?.gap : undefined;
  const parts = storyParts(storyType);
  const marked = gap ? partForGap(gap, parts) : undefined;
  const pending = pendingFollowUps(content);
  return (
    <section
      className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"
      data-testid="draft-so-far"
    >
      <h2 className="text-xs font-bold uppercase tracking-wide text-ink-800">
        {rough ? "Your rough draft" : "Your story"}
      </h2>
      {rough && (
        <p className="mt-1 text-sm text-slate-600">
          {pending === 1 ? "One question left" : `${pending} questions left`}, then I&apos;ll
          rewrite it with your answers.
        </p>
      )}
      <div className="mt-3 flex max-h-[28rem] flex-col gap-2 overflow-y-auto text-sm leading-relaxed text-slate-700">
        {parts.map((p) =>
          draft.parts[p.id]?.trim() ? (
            <p
              key={p.id}
              className={
                p.id === marked ? "-mx-2 rounded-lg bg-accent-50 px-2 py-1 ring-1 ring-accent-300" : ""
              }
              data-testid={p.id === marked ? "draft-part-marked" : undefined}
            >
              {p.id === marked && (
                <span className="block text-xs font-semibold uppercase tracking-wide text-ink-700">
                  {p.label}: this question improves it
                </span>
              )}
              {draft.parts[p.id]}
            </p>
          ) : p.id === marked ? (
            <p key={p.id} className="-mx-2 rounded-lg bg-accent-50 px-2 py-1 text-slate-500 ring-1 ring-accent-300">
              {p.label}: missing so far. This question fills it in.
            </p>
          ) : null,
        )}
      </div>
      {!rough && (
        <button
          type="button"
          onClick={onShowStory}
          className="mt-3 text-sm font-medium text-ink-800 hover:underline"
        >
          See your story and its score →
        </button>
      )}
    </section>
  );
}

// The story part a follow-up's gap lands in.
function partForGap(gap: string, parts: readonly StoryPart[]): string {
  return parts.find((p) => p.id === gap)?.id ?? GAP_TO_PART[gap] ?? parts[0].id;
}

function partLabelForGap(gap: string, storyType: StoryType | undefined): string | undefined {
  const parts = storyParts(storyType);
  if (!gap || (!parts.some((p) => p.id === gap) && !GAP_TO_PART[gap])) return undefined;
  return parts.find((p) => p.id === partForGap(gap, parts))?.label;
}

function Exchange({
  question,
  answer,
  hint,
  source,
  skipped,
  improves,
  help,
  joggers,
  onDontKnow,
  onEstimate,
  isEditing,
  disabled,
  onEdit,
  onCancel,
  onSubmit,
}: {
  question: string;
  answer: string | undefined;
  // A nudge under the question, e.g. which target job the story should fit.
  hint?: string;
  // Passed on with "I don't know this".
  skipped?: boolean;
  // The part of the draft this follow-up makes stronger, e.g. "Result".
  improves?: string;
  // "Show me a good answer", and where to look when they don't know.
  help?: QuestionHelp;
  // Memory joggers under the opening question.
  joggers?: React.ReactNode;
  // "I don't know this": passes on the question.
  onDontKnow?: () => void;
  // For a number question: starts the answer as a labelled estimate.
  onEstimate?: (text: string) => void;
  // Where a prefilled answer came from, e.g. "From your LinkedIn".
  source?: string;
  isEditing: boolean;
  disabled: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSubmit: (answer: string) => void;
}) {
  return (
    <li className="flex flex-col gap-2">
      {improves && (
        <p className="pl-1 text-xs font-semibold uppercase tracking-wide text-ink-700">
          Improves: {improves}
        </p>
      )}
      <CoachBubble>{question}</CoachBubble>
      {hint && (
        <p className="max-w-[90%] pl-1 text-sm text-slate-600" data-testid="question-hint">
          {hint}
        </p>
      )}
      {joggers}
      {!answer && !skipped && !isEditing && (help || onDontKnow) && (
        <QuestionHelpRow
          help={help}
          disabled={disabled}
          onDontKnow={onDontKnow}
          onEstimate={onEstimate}
        />
      )}
      {skipped && !isEditing && (
        <div className="flex flex-col items-end gap-1">
          <p className="text-sm italic text-slate-500">Skipped: I&apos;ll leave this out.</p>
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            className="text-xs font-medium text-slate-500 hover:text-ink-800 disabled:opacity-50"
          >
            Answer it after all
          </button>
        </div>
      )}
      {isEditing ? (
        <Composer
          initial={answer ?? ""}
          disabled={disabled}
          submitLabel="Save"
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      ) : answer ? (
        <div className="flex flex-col items-end gap-1">
          <p className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink-800 px-4 py-3 text-white">
            {answer}
          </p>
          {source && <p className="text-xs text-slate-500">{source}</p>}
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            className="text-xs font-medium text-slate-500 hover:text-ink-800 disabled:opacity-50"
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
  insert,
  rows = 3,
  disabled,
  submitLabel,
  onSubmit,
  onCancel,
  onSkip,
  skipLabel,
}: {
  initial: string;
  // Text to add to the box (a memory jogger the user tapped); a new `n` adds it again.
  insert?: { text: string; n: number };
  rows?: number;
  disabled: boolean;
  submitLabel: string;
  onSubmit: (answer: string) => void;
  onCancel?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  const [text, setText] = useState(initial);
  const [talking, setTalking] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  // A tapped jogger is added to whatever is typed so far (state adjusted during render, not in an
  // effect, so it lands in one pass).
  const [inserted, setInserted] = useState(insert?.n);
  if (insert && insert.n !== inserted) {
    setInserted(insert.n);
    setText((t) => (t.trim() ? `${t.trimEnd()}\n${insert.text}` : insert.text));
  }

  const canSubmit = !disabled && !talking && text.trim().length > 0;

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
        rows={rows}
        maxLength={MAX_ANSWER_LENGTH}
        placeholder="Type or tap Talk. Plain notes are fine."
        className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-ink-600 focus:bg-white focus:ring-2 focus:ring-ink-600/20"
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="mr-auto flex flex-wrap items-center gap-3">
          <MicButton
            disabled={disabled}
            onActiveChange={setTalking}
            onText={(spoken) => setText((t) => appendSpoken(t, spoken, MAX_ANSWER_LENGTH))}
          />
          {!talking && (
            <span className="hidden text-xs text-slate-400 sm:inline">
              Ctrl or ⌘ + Enter to send
            </span>
          )}
        </div>
        {onSkip && !talking && (
          <button
            type="button"
            onClick={onSkip}
            disabled={disabled}
            className="rounded-xl px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            data-testid="skip-follow-ups"
          >
            {skipLabel ?? "Skip the rest"}
          </button>
        )}
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
          className="rounded-xl bg-ink-800 px-5 py-2 font-semibold text-white transition hover:bg-ink-900 disabled:opacity-50"
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
      <p className="text-sm text-slate-600" data-testid="role-map-link">
        Built on your role map.{" "}
        <Link href={href} className="font-medium text-ink-800 hover:underline">
          See your role profile
        </Link>
      </p>
    );
  }
  if (!prominent) {
    return (
      <p className="text-sm text-slate-600" data-testid="role-map-link">
        Want words for what you did?{" "}
        <Link href={href} className="font-medium text-ink-800 hover:underline">
          Map my role
        </Link>
      </p>
    );
  }
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-2xl bg-ink-800 p-4 text-white"
      data-testid="role-map-card"
    >
      <p>
        <span className="font-semibold">Not sure how to describe your role?</span> Map it first, and
        I&apos;ll fill in these answers from it.
      </p>
      <Link
        href={href}
        className="rounded-xl bg-white px-4 py-2 font-semibold text-ink-900 hover:bg-ink-50"
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
      className="flex flex-col gap-3 rounded-2xl border border-dashed border-ink-200 bg-ink-50/50 p-4"
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
          className="min-w-0 flex-1 text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:font-medium file:text-ink-800 file:ring-1 file:ring-ink-800/20"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-xl bg-ink-800 px-4 py-2 font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
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
    <p className="max-w-[90%] rounded-2xl rounded-bl-md bg-ink-50 px-4 py-3 text-slate-800">
      {children}
    </p>
  );
}

function CoachLine({ children }: { children: React.ReactNode }) {
  return <li className="pt-2 text-sm font-semibold text-ink-900">{children}</li>;
}

function Thinking({ children }: { children: React.ReactNode }) {
  return (
    <li role="status" className="flex items-center gap-2 text-sm text-slate-600">
      <span className="h-2 w-2 animate-pulse rounded-full bg-ink-600" />
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
    <div className="flex flex-col items-start gap-3">
      <p className="text-slate-700">{text}</p>
      <div className="flex flex-wrap gap-2">
        {extra && (
          <button
            type="button"
            onClick={extra.onClick}
            className="rounded-xl bg-ink-800 px-4 py-2 font-semibold text-white hover:bg-ink-900"
          >
            {extra.button}
          </button>
        )}
        <button
          type="button"
          onClick={onClick}
          className={
            secondary
              ? "rounded-xl px-4 py-2 font-semibold text-ink-800 ring-1 ring-ink-800/30 hover:bg-ink-50"
              : "rounded-xl bg-ink-800 px-4 py-2 font-semibold text-white hover:bg-ink-900"
          }
        >
          {button}
        </button>
      </div>
    </div>
  );
}

function StoryPanel({
  title,
  content,
  storyType,
  writing,
  children,
}: {
  title: string;
  content: StoryContent;
  storyType: StoryType | undefined;
  writing: boolean;
  // Actions under the story.
  children?: React.ReactNode;
}) {
  const draft = content.draft;
  const parts = storyParts(storyType);
  const storyTypeLabel = storyType?.label;
  // A written story reads as one script to say aloud; the parts view is for checking what went where.
  const [showParts, setShowParts] = useState(false);
  const paragraphs = draft ? parts.map((p) => draft.parts[p.id]).filter(Boolean) : [];
  const words = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  // At an interview pace of about 150 words a minute.
  const seconds = Math.round(((words / 150) * 60) / 5) * 5;

  return (
    <section
      className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition sm:p-6 ${
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
          <CopyButton
            text={paragraphs.join("\n\n")}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50"
          />
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
            className="font-medium text-ink-800 hover:underline"
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
                      written ? "bg-ink-600" : notes.length ? "bg-ink-300" : "bg-slate-200"
                    }`}
                  />
                  {part.label}
                </h3>
                {written ? (
                  <p className="mt-1 leading-relaxed text-slate-800">
                    <Highlighted text={written} marks={draft?.untracedNumbers ?? []} />
                  </p>
                ) : notes.length ? (
                  <ul className="mt-1 flex flex-col gap-1 border-l-2 border-ink-100 pl-3 text-sm text-slate-500">
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
      {children}
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
    ...answerableQuestions(storyType)
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
      <p className="mt-2 text-sm font-medium text-emerald-700" data-testid="number-check">
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
