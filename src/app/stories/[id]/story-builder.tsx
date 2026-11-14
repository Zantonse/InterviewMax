"use client";

import Link from "next/link";
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { SCORE_LABELS } from "@/lib/stories/grading";
import { CopyButton } from "@/components/copy-button";
import { MicButton } from "@/components/mic-button";
import { type FieldId, fieldJoggers } from "@/lib/field/fields";
import { suggestRoleMap } from "@/lib/roles/role-map";
import {
  builderStage,
  canStrengthen,
  weakIntroPart,
  type WeakPart,
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
  analyzeDraft,
  askAboutWeakPart,
  askFollowUps,
  dismissLevelUp,
  levelUp,
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
import {
  type BuilderTargets,
  GUIDED_START_PROMPTS,
  guidedStart,
  nextRoleHint,
  openingHint,
} from "@/lib/stories/targets";
import { appendSpoken } from "@/lib/voice/text";
import { answerProblem } from "@/lib/text/answer";
import { AnswerLimit } from "@/components/answer-limit";
import { analysisIsCurrent } from "@/lib/analysis/content";
import { AnalysisView } from "./analysis-view";
import { ColouredScript, SpokenBar } from "./story-colours";
import { applyInsert, type Insert } from "@/lib/stories/insert";
import { quickLine, quickPicked, quickStartRows } from "@/lib/stories/quick-start";
import { EvaluationPanel } from "./evaluation-panel";
import { LevelCard } from "./level-card";
import { TOP_LEVEL, levelInfo, storyLevel, usesLevels } from "@/lib/stories/levels";
import { TellingPanel } from "./telling-panel";
import { AlsoAnswersPanel } from "./also-answers-panel";
import { ExecPanel } from "./exec-panel";
import { AiNotice } from "@/components/ai-notice";

type Busy =
  | null
  | "saving"
  | "reading"
  | "inferring"
  | "probing"
  | "leveling"
  | "writing"
  | "grading"
  | "coaching"
  | "analyzing";
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
  field = null,
  execMode = false,
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
  // The user's field (Settings): picks the examples and memory joggers.
  field?: FieldId | null;
  // Exec mode (Settings, off by default): shows the Exec version card on the written story.
  execMode?: boolean;
}) {
  const storyType = getStoryType(storyTypeId);
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [busy, setBusy] = useState<Busy>(null);
  // The saved story's id, read when each action runs (a new story gets one with its first answer).
  const idRef = useRef(storyId);
  const sid = (): string => idRef.current ?? "";
  // Whether a chain of actions is running (read in the tap handler, before any render).
  const running = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [, startTransition] = useTransition();
  // Text a memory jogger adds to (or, tapped again, takes out of) the answer box; `n` makes each
  // tap count.
  const [insert, setInsert] = useState<Insert | undefined>();
  // What's in the answer box now, so a tapped starter can show it's in there.
  const [answerText, setAnswerText] = useState("");
  // Build is the chat; Story & score is the written story beside its evaluation.
  const [view, setView] = useState<View>(
    initialContent.draft && nextFollowUpIndex(initialContent) === undefined ? "story" : "build",
  );

  const questions = coreQuestions(storyType);
  const stage = builderStage(content, storyType);
  // Story levels: below the top level, "Help me reach Level N" replaces "Ask me more".
  const level = storyLevel(content, storyType);
  const levelLeads = level !== undefined && level < TOP_LEVEL && gradeIsCurrent(content);

  // Runs a chain of actions, applying each result. Stops at the first error.
  function run(steps: { busy: Exclude<Busy, null>; action: () => Promise<BuilderResult> }[]) {
    // One chain at a time: a second tap while one runs does nothing.
    if (running.current) return;
    running.current = true;
    setError(null);
    // Shown straight away, outside the transition: React holds updates made inside an async
    // transition before its first await until the whole chain ends, so the button looked dead for
    // the length of the model call and simulated users tapped it again and again (2026-11-08).
    setBusy(!idRef.current && newStory ? "saving" : steps[0].busy);
    startTransition(async () => {
      try {
        await runSteps(steps);
      } finally {
        running.current = false;
        setBusy(null);
      }
    });
  }

  async function runSteps(steps: { busy: Exclude<Busy, null>; action: () => Promise<BuilderResult> }[]) {
    {
      if (!idRef.current && newStory) {
        setBusy("saving");
        const created = await createStory(newStory.storyType, newStory.asked);
        if (!created.ok) {
          setError(created.error);
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
        if (
          (step.busy === "probing" || step.busy === "leveling") &&
          nextFollowUpIndex(result.content) !== undefined
        ) {
          setView("build");
        }
        // A level-up with nothing to ask goes straight on to the rewrite.
        if (
          step.busy === "leveling" &&
          i === steps.length - 1 &&
          result.content.levelUp &&
          result.content.levelUp.reached === undefined &&
          nextFollowUpIndex(result.content) === undefined
        ) {
          steps.push({ busy: "writing", action: () => writeDraft(sid()) });
          continue;
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
    }
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
  // story, it's rewritten only if this round's answers added something. Text typed in the box but
  // not sent is kept as the open question's answer first: simulated users typed and then tapped
  // Skip, and lost it (2026-11-08).
  function skipRest(typed = "") {
    setEditing(null);
    const open = nextFollowUpIndex(content);
    const keep = typed.trim() && open !== undefined ? { index: open, answer: typed } : undefined;
    const round = Math.max(0, ...(content.followUps ?? []).map((f) => f.round ?? 1));
    const addedThisRound =
      Boolean(keep) ||
      (content.followUps ?? []).some((f) => (f.round ?? 1) === round && f.answer?.trim());
    run([
      ...(keep
        ? [
            {
              busy: "saving" as const,
              action: () => saveFollowUpAnswer(sid(), keep.index, keep.answer),
            },
          ]
        : []),
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

  // Story levels: questions aimed at the next level, then (once answered) the rewrite and grade.
  function climb() {
    run([{ busy: "leveling", action: () => levelUp(sid()) }]);
  }

  function submitUpload(formData: FormData) {
    setEditing(null);
    run([{ busy: "saving", action: () => importPreparedAnswer(sid(), formData) }]);
  }

  function submitLinkedIn(formData: FormData) {
    setEditing(null);
    run([{ busy: "reading", action: () => importLinkedIn(sid(), formData) }]);
  }

  const weak = busy ? undefined : weakIntroPart(content, storyType);
  const currentCore = nextCoreQuestion(content, storyType);
  const currentFollowUp = nextFollowUpIndex(content);
  // Where an unsent answer is kept, so leaving the box (another tab, a reload) doesn't lose it.
  const draftScope = `imx-answer:${storyId ?? `new-${storyTypeId}`}`;
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
          <ViewTabs view={view} onChange={setView} />
          {menu && (
            <details className="relative" data-testid="story-menu">
              <summary
                aria-label="More options"
                className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl text-lg leading-none text-slate-600 ring-1 ring-slate-300 hover:bg-white [&::-webkit-details-marker]:hidden"
              >
                ⋯
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-72 origin-top-right animate-pop rounded-2xl bg-white p-4 shadow-lg ring-1 ring-black/10">
                {menu}
              </div>
            </details>
          )}
        </div>
      </div>

      {view === "build" ? (
        <div className="mt-4 grid animate-enter grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
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
                <li className="animate-enter text-sm text-slate-500" data-testid="builder-intro">
                  {storyType?.format === "intro"
                    ? `Answer ${questions.length} short questions in plain notes, typed or spoken. I write it from your words.`
                    : "Tell it your way. Messy notes or a minute of talking is plenty."}
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
                        : questionHelp(
                            q.id === "start" && storyType?.format !== "intro" ? "telling" : q.part,
                            field,
                          )
                    }
                    joggers={
                      q.id === "start" && !content.answers[q.id]?.trim() && !seed ? (
                        <>
                          <Joggers
                            storyType={storyType}
                            field={field}
                            moments={moments}
                            disabled={busy !== null}
                            onPick={(text) => setInsert((n) => ({ text, n: (n?.n ?? 0) + 1 }))}
                          />
                          {storyType?.format === "star" && !content.tough && (
                            <QuickStart
                              storyTypeId={storyTypeId}
                              answerText={answerText}
                              disabled={busy !== null}
                              onPick={(pick) => setInsert((n) => ({ ...pick, n: (n?.n ?? 0) + 1 }))}
                            />
                          )}
                        </>
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
                        {round === content.levelUp?.round
                          ? `To reach Level ${content.levelUp.target}, ${levelInfo(content.levelUp.target).name.toLowerCase()}: ${levelInfo(content.levelUp.target).lesson} A few questions about just that:`
                          : round === 1
                            ? content.draft && usesLevels(storyType, content)
                              ? "I've written a rough draft. That's Level 1: it happened. A few quick questions to get it to Level 2, so it proves something, easiest first:"
                              : content.draft && storyType?.format !== "intro"
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
                      help={index === currentFollowUp ? questionHelp(f.gap, field) : undefined}
                      joggers={
                        index === currentFollowUp && f.options?.length ? (
                          <TapOptions
                            options={f.options}
                            answerText={answerText}
                            disabled={busy !== null}
                            onPick={(text, remove) =>
                              setInsert((n) => ({ text, n: (n?.n ?? 0) + 1, remove }))
                            }
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
                    draftKey={inferredNow ? undefined : `${draftScope}:core-${currentCore}`}
                    insert={insert}
                    onTextChange={setAnswerText}
                    placeholder={
                      currentCore === "start" && guidedStart(targets, storyType)
                        ? `${GUIDED_START_PROMPTS.join("\n")}\n\nA line or two for each is plenty.`
                        : undefined
                    }
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
                  draftKey={`${draftScope}:fu-${currentFollowUp}`}
                  insert={insert}
                  onTextChange={setAnswerText}
                  disabled={busy !== null}
                  submitLabel="Next"
                  onSubmit={(text) => submitFollowUp(currentFollowUp, text)}
                  onSkip={(typed) => skipRest(typed)}
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
                  text={
                    level !== undefined && gradeIsCurrent(content)
                      ? `Your story is at Level ${level}: ${levelInfo(level).name.toLowerCase()}.`
                      : "Your story is written."
                  }
                  button="See story & score"
                  onClick={() => setView("story")}
                  extra={
                    levelLeads
                      ? { button: `Help me reach Level ${(level ?? 1) + 1}`, onClick: climb }
                      : canStrengthen(content) && !content.nothingMoreToAsk
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
        <div className="mt-4 grid animate-enter grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <StoryPanel
              title={title}
              content={content}
              storyType={storyType}
              writing={busy === "writing"}
              analyzing={busy === "analyzing"}
              disabled={busy !== null}
              onAnalyze={() => run([{ busy: "analyzing", action: () => analyzeDraft(sid()) }])}
            >
              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </p>
              )}
              {content.draft ? (
                <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5">
                  {weak && (
                    <WeakPartCallout
                      part={weak}
                      disabled={busy !== null}
                      busy={busy === "probing"}
                      onAsk={() =>
                        run([{ busy: "probing", action: () => askAboutWeakPart(sid()) }])
                      }
                    />
                  )}
                  {content.nothingMoreToAsk && (
                    <p className="text-sm text-slate-600">
                      I couldn&apos;t find anything more to ask. Change an answer and I&apos;ll look
                      again.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {canStrengthen(content) && !content.nothingMoreToAsk && !levelLeads && (
                      <button
                        type="button"
                        onClick={strengthen}
                        disabled={busy !== null}
                        aria-busy={busy === "probing"}
                        className="rounded-xl bg-ink-800 px-4 py-2 font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
                      >
                        {/* The questions appear on the Build tab; until then this is the only sign
                            on this tab that anything is happening (round 27 personas read it as dead). */}
                        {busy === "probing" ? "Finding more questions…" : "Ask me more to make it stronger"}
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
            <LevelCard
              content={content}
              storyType={storyType}
              busy={busy === "leveling" ? "asking" : busy === "writing" && content.levelUp && content.levelUp.reached === undefined ? "writing" : null}
              disabled={busy !== null}
              onLevelUp={climb}
              onDismiss={() => run([{ busy: "saving", action: () => dismissLevelUp(sid()) }])}
              onShowQuestions={() => setView("build")}
            />
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
            {execMode && (
              <ExecPanel
                storyId={sid}
                content={content}
                storyType={storyType}
                disabled={busy !== null}
                onContent={setContent}
              />
            )}
            <AlsoAnswersPanel
              storyId={sid}
              content={content}
              storyType={storyType}
              disabled={busy !== null}
              onContent={setContent}
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

// Build | Story & score. One white pill slides between the tabs (the same object moving, not one
// disappearing and another appearing). Before it's measured, the selected tab draws its own pill.
function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const tabs = useRef<Partial<Record<View, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const el = tabs.current[view];
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [view]);
  return (
    <div
      role="tablist"
      aria-label="Story views"
      className="relative flex rounded-full bg-slate-200/70 p-1 text-sm font-semibold"
    >
      {pill && (
        <span
          aria-hidden
          className="absolute inset-y-1 left-0 rounded-full bg-white shadow-sm transition-[translate,width] duration-250 ease-in-out"
          style={{ translate: `${pill.left}px 0`, width: pill.width }}
        />
      )}
      {VIEWS.map((v, i) => (
        <button
          key={v.id}
          ref={(el) => {
            tabs.current[v.id] = el;
          }}
          type="button"
          role="tab"
          aria-selected={view === v.id}
          onClick={() => onChange(v.id)}
          className={`relative rounded-full px-3.5 py-1.5 transition-colors duration-200 ${
            view === v.id
              ? `text-ink-800 ${pill ? "" : "bg-white shadow-sm"}`
              : "text-slate-600 hover:text-slate-900"
          }`}
          data-testid={`tab-${v.id}`}
        >
          {i + 1} · {v.label}
        </button>
      ))}
    </div>
  );
}

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
                className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors duration-300 ${
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
  field,
  moments,
  disabled,
  onPick,
}: {
  storyType: StoryType | undefined;
  field: FieldId | null;
  moments: JoggerMoment[];
  disabled: boolean;
  onPick: (text: string) => void;
}) {
  const general: readonly string[] =
    fieldJoggers(field, storyType?.id) ?? storyType?.joggers ?? [];
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
          <div className="flex flex-wrap gap-2" data-stagger>
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
          <div className="flex flex-wrap gap-2" data-stagger>
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

// Under the opening question of a behavioral story: three rows of taps (what was at stake, their
// part, how it ended), one pick per row, that start the answer as notes. Picking another option in
// a row swaps its line; tapping the picked one again takes it out.
function QuickStart({
  storyTypeId,
  answerText,
  disabled,
  onPick,
}: {
  storyTypeId: string | null;
  answerText: string;
  disabled: boolean;
  onPick: (pick: { text: string; remove?: boolean; replace?: string }) => void;
}) {
  const rows = quickStartRows(storyTypeId);
  const anyPicked = rows.some((row) => quickPicked(row, answerText));
  return (
    <div
      className="flex max-w-[90%] flex-col gap-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"
      data-testid="quick-start"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-ink-800">Quick start: tap what fits</p>
      {rows.map((row) => {
        const picked = quickPicked(row, answerText);
        return (
          <div
            key={row.id}
            role="radiogroup"
            aria-label={row.label}
            className="flex flex-col gap-1 sm:flex-row sm:items-center"
          >
            <span className="w-28 shrink-0 text-sm font-medium text-slate-600">{row.label}</span>
            <span className="flex flex-wrap gap-1.5">
            {row.options.map((o) => {
              const on = picked === o;
              return (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={disabled}
                  onClick={() =>
                    onPick(
                      on
                        ? { text: quickLine(row, o), remove: true }
                        : picked
                          ? { text: quickLine(row, o), replace: quickLine(row, picked) }
                          : { text: quickLine(row, o) },
                    )
                  }
                  className={`rounded-full px-3 py-1 text-sm ring-1 transition-colors disabled:opacity-50 ${
                    on
                      ? "bg-ink-800 text-white ring-ink-800"
                      : "bg-white text-slate-700 ring-slate-300 hover:bg-ink-50 hover:ring-ink-800/30"
                  }`}
                  data-testid={`quick-${row.id}`}
                >
                  {on && <span aria-hidden="true">✓ </span>}
                  {o}
                </button>
              );
            })}
            </span>
          </div>
        );
      })}
      <p className="text-xs text-slate-500" aria-live="polite">
        {anyPicked
          ? "Now add what happened in a sentence or two, then send."
          : "Each tap adds a line to your answer."}
      </p>
    </div>
  );
}

// Under a follow-up about a kind of thing (their part, the stakes, the kind of result): the coach's
// starters. A tap puts one in the answer box to finish in their own words; one that's in the box
// shows as picked, and tapping it again takes it out (simulated users tapped a starter dozens of
// times when nothing on the chip changed, 2026-11-08).
function TapOptions({
  options,
  answerText,
  disabled,
  onPick,
}: {
  options: string[];
  answerText: string;
  disabled: boolean;
  onPick: (text: string, remove: boolean) => void;
}) {
  const picked = options.filter((o) => answerText.includes(o));
  return (
    <div className="flex max-w-[90%] flex-col gap-2 pl-1" data-testid="tap-options">
      <div className="flex flex-wrap gap-2" data-stagger>
        {options.map((o) => {
          const on = picked.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onPick(`${o}. `, on)}
              className={`rounded-full px-3 py-1.5 text-left text-sm ring-1 disabled:opacity-50 ${
                on
                  ? "bg-ink-800 text-white ring-ink-800 hover:bg-ink-900"
                  : "bg-white text-slate-700 ring-slate-300 hover:bg-ink-50 hover:ring-ink-800/30"
              }`}
            >
              {on && <span aria-hidden="true">✓ </span>}
              {o}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500" aria-live="polite">
        {picked.length
          ? "Added to your answer below. Finish it with a sentence in your words, then tap Next."
          : "Tap one to start, then add a sentence in your words."}
      </p>
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
  const justWritten = useJustWritten(draft);
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
                className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors duration-300 ${
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
  const followUps = content.followUps ?? [];
  const gap = current !== undefined ? followUps[current]?.gap : undefined;
  const parts = storyParts(storyType);
  const marked = gap ? partForGap(gap, parts) : undefined;
  const pending = pendingFollowUps(content);
  // This round's questions, one pip each, so "how many left" is a picture, not a sentence.
  const round = current !== undefined ? (followUps[current]?.round ?? 1) : undefined;
  const roundQuestions = followUps
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.source !== "practice" && (f.round ?? 1) === round);
  // Parts a later question in this round will fill in.
  const coming = new Set(
    followUps
      .filter((f, i) => i !== current && !f.answer?.trim() && !f.skipped && f.source !== "practice")
      .map((f) => partForGap(f.gap, parts)),
  );
  const target =
    content.levelUp && content.levelUp.round === round ? content.levelUp.target : 2;
  const showLevel = rough && usesLevels(storyType, content);
  return (
    <section
      className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 ${justWritten ? "animate-success" : ""}`}
      data-testid="draft-so-far"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-800">
          {rough ? "Your story so far" : "Your story"}
        </h2>
        {showLevel && (
          <span className="text-xs font-medium text-slate-500" data-testid="draft-level">
            Level {target - 1} → {target}
          </span>
        )}
      </div>
      {rough && roundQuestions.length > 0 && (
        <div className="mt-2" data-testid="draft-pips">
          <div className="flex gap-1" aria-hidden="true">
            {roundQuestions.map(({ f, i }) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  i === current
                    ? "bg-accent-500"
                    : f.answer?.trim() || f.skipped
                      ? "bg-ink-800"
                      : "bg-slate-200"
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {pending === 1 ? "1 question left" : `${pending} questions left`}, then I rewrite it
          </p>
        </div>
      )}
      <ol
        className="relative mt-4 flex max-h-[30rem] flex-col gap-1 overflow-y-auto pl-7"
        data-testid="story-shape"
      >
        <span
          aria-hidden="true"
          className="absolute bottom-3 left-[0.6rem] top-3 w-0.5 rounded-full bg-slate-200"
        />
        {parts.map((p) => {
          const text = draft.parts[p.id]?.trim();
          const now = p.id === marked;
          const state = now ? "now" : text ? "done" : "empty";
          return (
            <li
              key={p.id}
              className={`relative -ml-2 rounded-xl px-2 py-1.5 transition-colors duration-300 ${
                now ? "bg-accent-50" : ""
              }`}
              data-testid={now ? "draft-part-marked" : `draft-part-${state}`}
            >
              <span
                aria-hidden="true"
                className={`absolute -left-[1.1rem] top-2 flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                  state === "done"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : state === "now"
                      ? "border-accent-600 bg-accent-200 ring-4 ring-accent-100"
                      : "border-slate-300 bg-white"
                }`}
              >
                {state === "done" && (
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M2.5 6.2 5 8.5l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <p
                className={`text-sm font-semibold ${state === "empty" ? "text-slate-500" : "text-slate-900"}`}
              >
                {p.label}
                {now && <span className="font-medium text-accent-700"> · answering now</span>}
              </p>
              {text ? (
                <p
                  key={text}
                  className={`animate-fade text-sm leading-relaxed text-slate-700 ${now ? "" : "line-clamp-3"}`}
                >
                  {text}
                </p>
              ) : (
                <p className="text-sm italic text-slate-400">
                  {now
                    ? "Missing so far. This question fills it in."
                    : coming.has(p.id)
                      ? "A question coming fills this in."
                      : "Not in your story yet."}
                </p>
              )}
            </li>
          );
        })}
      </ol>
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
    <li className="flex animate-enter flex-col gap-2">
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
          <p className="max-w-[90%] origin-bottom-right animate-pop whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink-800 px-4 py-3 text-white">
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
  onTextChange,
  placeholder,
  rows = 3,
  disabled,
  submitLabel,
  onSubmit,
  onCancel,
  onSkip,
  skipLabel,
  draftKey,
}: {
  initial: string;
  // Text to add to the box (a memory jogger the user tapped); a new `n` adds it again.
  insert?: Insert;
  // Told what's in the box as it changes.
  onTextChange?: (text: string) => void;
  placeholder?: string;
  rows?: number;
  disabled: boolean;
  submitLabel: string;
  onSubmit: (answer: string) => void;
  onCancel?: () => void;
  // Told what's typed, so it can be kept rather than dropped.
  onSkip?: (typed: string) => void;
  skipLabel?: string;
  // Keeps what's typed (not yet sent) in this tab under this key, and brings it back.
  draftKey?: string;
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
  // effect, so it lands in one pass), and the cursor goes to the end to keep typing.
  const [inserted, setInserted] = useState(insert?.n);
  if (insert && insert.n !== inserted) {
    setInserted(insert.n);
    setText((t) => applyInsert(t, insert));
  }
  useEffect(() => {
    if (inserted === undefined) return;
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }, [inserted]);

  useEffect(() => {
    onTextChange?.(text);
  }, [text, onTextChange]);

  // An unsent answer comes back when the box does (after a tab switch or a reload), unless the
  // box opened with something in it already.
  useEffect(() => {
    if (!draftKey || initial) return;
    const saved = readKept(draftKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restored once on mount; storage isn't readable during render without a hydration mismatch
    if (saved) setText(saved);
  }, [draftKey, initial]);
  useEffect(() => {
    if (draftKey) writeKept(draftKey, text === initial ? "" : text);
  }, [draftKey, text, initial]);

  function send(answer: string) {
    if (draftKey) writeKept(draftKey, "");
    onSubmit(answer);
  }

  const canSubmit =
    !disabled &&
    !talking &&
    text.trim().length > 0 &&
    answerProblem(text, MAX_ANSWER_LENGTH) === null;

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) send(text);
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
            send(text);
          }
        }}
        rows={rows}
        placeholder={placeholder ?? "Type or tap Talk. Plain notes are fine."}
        className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-ink-600 focus:bg-white focus:ring-2 focus:ring-ink-600/20"
      />
      <AnswerLimit text={text} max={MAX_ANSWER_LENGTH} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="mr-auto flex flex-wrap items-center gap-3">
          <MicButton
            disabled={disabled}
            onActiveChange={setTalking}
            onText={(spoken) => setText((t) => appendSpoken(t, spoken))}
          />
          {/* Simulated users typed and typed without sending (2026-11-08): once there's text, say
              how to send it. */}
          {!talking && canSubmit ? (
            <span className="text-xs font-medium text-ink-800" data-testid="send-hint">
              Done? Tap {submitLabel} to send it.
            </span>
          ) : !talking ? (
            <span className="hidden text-xs text-slate-400 sm:inline">
              Ctrl or ⌘ + Enter to send
            </span>
          ) : null}
        </div>
        {onSkip && !talking && (
          <button
            type="button"
            onClick={() => {
              if (draftKey) writeKept(draftKey, "");
              onSkip(text);
            }}
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

// Unsent answers, per tab. Storage can be blocked (private windows), so every call is guarded.
function readKept(key: string): string {
  try {
    return window.sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function writeKept(key: string, text: string) {
  try {
    if (text.trim()) window.sessionStorage.setItem(key, text);
    else window.sessionStorage.removeItem(key);
  } catch {
    // Not kept; the box still works.
  }
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
    <p className="max-w-[90%] origin-bottom-left animate-pop rounded-2xl rounded-bl-md bg-ink-50 px-4 py-3 text-slate-800">
      {children}
    </p>
  );
}

function CoachLine({ children }: { children: React.ReactNode }) {
  return <li className="animate-enter pt-2 text-sm font-semibold text-ink-900">{children}</li>;
}

function Thinking({ children }: { children: React.ReactNode }) {
  return (
    <li role="status" className="flex animate-fade items-center gap-2 text-sm text-slate-600">
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

// True for a moment after the written story changes (a draft or a rewrite just landed), so the
// story can pulse once to say so. Not on first load.
function useJustWritten(draft: StoryContent["draft"]) {
  const text = draft ? Object.values(draft.parts).join("\n") : "";
  const [was, setWas] = useState(text);
  const [pulse, setPulse] = useState(false);
  if (text !== was) {
    setWas(text);
    if (text) setPulse(true);
  }
  useEffect(() => {
    if (!pulse) return;
    const t = setTimeout(() => setPulse(false), 800);
    return () => clearTimeout(t);
  }, [pulse]);
  return pulse;
}

function StoryPanel({
  title,
  content,
  storyType,
  writing,
  analyzing,
  disabled,
  onAnalyze,
  children,
}: {
  title: string;
  content: StoryContent;
  storyType: StoryType | undefined;
  writing: boolean;
  // "Why it works": what each paragraph gives the interviewer.
  analyzing: boolean;
  disabled: boolean;
  onAnalyze: () => void;
  // Actions under the story.
  children?: React.ReactNode;
}) {
  const draft = content.draft;
  const parts = storyParts(storyType);
  const storyTypeLabel = storyType?.label;
  // A written story shows each part in its colour, so what's there and what's missing is a picture;
  // "Plain script" is the version to read aloud.
  const [plain, setPlain] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const paragraphs = draft ? parts.map((p) => draft.parts[p.id]).filter(Boolean) : [];
  const justWritten = useJustWritten(draft);

  return (
    <section
      className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition sm:p-6 ${
        writing ? "opacity-60" : ""
      } ${justWritten ? "animate-success" : ""}`}
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
        <>
          <div className="mt-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm">
            {!showWhy && (
              <button
                type="button"
                onClick={() => setPlain((v) => !v)}
                className="font-medium text-ink-800 hover:underline"
                data-testid="plain-toggle"
              >
                {plain ? "Colour by part" : "Plain script"}
              </button>
            )}
            <WhyToggle
              on={showWhy}
              onChange={(on) => {
                setShowWhy(on);
                if (on && !analysisIsCurrent(content.analysis, draft.writtenAt) && !disabled) {
                  onAnalyze();
                }
              }}
            />
          </div>
          <SpokenBar draft={draft} storyType={storyType} />
        </>
      )}

      {draft && showWhy ? (
        <AnalysisView
          content={content}
          storyType={storyType}
          analyzing={analyzing}
          disabled={disabled}
          onAnalyze={onAnalyze}
        />
      ) : draft && !plain ? (
        <>
          <ColouredScript draft={draft} storyType={storyType} />
          <NumberCheck untraced={draft.untracedNumbers} />
        </>
      ) : draft ? (
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
        // Before the story is written: what each part has to go on so far.
        <div className="mt-5 flex flex-col gap-4">
          {parts.map((part) => {
            const notes = notesForPart(content, storyType, parts, part);
            return (
              <div key={part.id} data-testid={`part-${part.id}`}>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <span
                    className={`h-2 w-2 rounded-full ${notes.length ? "bg-ink-300" : "bg-slate-200"}`}
                  />
                  {part.label}
                </h3>
                {notes.length ? (
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
              </div>
            );
          })}
        </div>
      )}
      {children}
    </section>
  );
}

// Switches the story between the plain script and "Why it works".
function WhyToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-center gap-2 font-medium text-ink-800"
      data-testid="why-toggle"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${
          on ? "bg-ink-800" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            on ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
      Why it works
    </button>
  );
}


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

// "Tell me about yourself": the part the grader scored weakest, with one question to fix it.
function WeakPartCallout({
  part,
  disabled,
  busy,
  onAsk,
}: {
  part: WeakPart;
  disabled: boolean;
  busy: boolean;
  onAsk: () => void;
}) {
  return (
    <div
      className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200"
      data-testid="weak-part"
    >
      <p className="text-sm font-semibold text-amber-900">
        Weakest part: {part.label} ({SCORE_LABELS[part.score] ?? part.score}, {part.score} of 4)
      </p>
      {(part.improve || part.note) && (
        <p className="mt-1 text-sm text-amber-900/90">{part.improve || part.note}</p>
      )}
      <button
        type="button"
        onClick={onAsk}
        disabled={disabled}
        className="mt-3 rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
      >
        {busy ? "Thinking of a question…" : "Answer one question to fix it"}
      </button>
      <p className="mt-2 text-xs text-amber-900/70">
        I&apos;ll rewrite only this part from your answer and leave the rest as it is.
      </p>
    </div>
  );
}
