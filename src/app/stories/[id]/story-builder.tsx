"use client";

import Link from "next/link";
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { SCORE_LABELS, gradingCriteria } from "@/lib/stories/grading";
import { CopyButton } from "@/components/copy-button";
import { END_OF_STORY, inlineLevelQuestions, type InlineQuestion } from "@/lib/stories/inline-questions";
import { MicButton } from "@/components/mic-button";
import type { FieldId } from "@/lib/field/fields";
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
  FINISH_STARTER_NOTE,
  onlyStarters,
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
import { WhyLead, whyNotes } from "./analysis-view";
import { applyInsert, type Insert } from "@/lib/stories/insert";
import { quickLine, quickPicked, quickStartRows } from "@/lib/stories/quick-start";
import {
  type Situation,
  joggersFor,
  partsFor,
  questionFor,
  stakesFor,
  storySituation,
} from "@/lib/stories/situation";
import { CoachRead, EvaluationPanel } from "./evaluation-panel";
import { LevelStep, gapPart, nextLevelGaps, useSpot } from "./level-step";
import { DraftTrack, LevelMeter, TalkTrack, aimFor, clock, trackLabel, trackRows } from "./talk-track";
import { ExampleLadder } from "@/components/example-ladder";
import { helpAmount, type HelpAmount } from "@/lib/stories/help-fade";
import { FinishLineBar } from "@/components/finish-line";
import { finishLine, writtenOn, type FinishCounts } from "@/lib/prep/finish-line";
import {
  TOP_LEVEL,
  displayLevel,
  levelInfo,
  storyLevel,
  usesLevels,
  type LevelGap,
  type StoryLevel,
} from "@/lib/stories/levels";
import { wordDiff } from "@/lib/stories/word-diff";
import { canTell } from "@/lib/telling/content";
import { canExec } from "@/lib/exec/content";
import { canRecruiter } from "@/lib/recruiter/content";
import { TellingPanel } from "./telling-panel";
import { AlsoAnswersPanel } from "./also-answers-panel";
import { ExecPanel } from "./exec-panel";
import { RecruiterPanel } from "./recruiter-panel";
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
  // CARL: what you did yourself is part of the Action; the old "Your role" part is in the Context.
  ownership: "actions",
  role: "situation",
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
  uses,
  nextUp,
  menu,
  beside,
  field = null,
  execMode = false,
  priorWritten = 0,
  finishBase,
  recruiterScreen = false,
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
  // Shown under the story on the Story and score view.
  afterStory?: React.ReactNode;
  // More rows for "Use this story" under the written story, e.g. a version for each job.
  uses?: React.ReactNode;
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
  // How many behavioral stories the user wrote before this one: the opening help fades with it
  // (see help-fade.ts).
  priorWritten?: number;
  // The finish line from the user's other stories; this one is added once it's written.
  finishBase?: FinishCounts;
  // A target job's next stage is a recruiter screen: shows the Recruiter version card.
  recruiterScreen?: boolean;
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
    // Level-up questions are answered on the story itself, so a story waiting on them opens there.
    initialContent.draft &&
      (nextFollowUpIndex(initialContent) === undefined ||
        inlineLevelQuestions(initialContent).length > 0)
      ? "story"
      : "build",
  );

  const questions = coreQuestions(storyType);
  // Who they are (field, entry level, whether they manage people), so the questions fit them.
  const situation = storySituation(content, storyType, targets, field);
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
          // Level-up questions show on the story itself (inline-questions.ts), so leveling stays put.
          step.busy === "probing" &&
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
  // Behavioral stories open with an example story and help that fades as the user writes more.
  const behavioral = storyType?.format === "carl" && !content.tough;
  const help = helpAmount(priorWritten);
  const showExample =
    behavioral && !content.draft && !content.answers.start?.trim() && !content.imported;
  const hints: Record<string, string | undefined> = {
    // Started from a real question, the question itself says what to pick.
    start: seed ? seedHint(seed) : content.asked ? undefined : openingHint(targets, storyType, situation.toManager),
    next: storyType?.format === "intro" ? nextRoleHint(targets, situation.toManager) : undefined,
  };

  // The written story's level, for the line under the title: the real levels for a behavioral
  // story, the tier shown as a level for the others.
  const grade = gradeIsCurrent(content) ? content.grade : undefined;
  const levelsOn = usesLevels(storyType, content);
  const metaLevel =
    level !== undefined ? level : grade && content.draft ? displayLevel(grade, storyType, content) : undefined;
  const track = trackRows(content.draft?.parts, storyType);
  const paragraphs = content.draft
    ? storyParts(storyType)
        .map((p) => content.draft?.parts[p.id])
        .filter((t): t is string => Boolean(t?.trim()))
    : [];
  // Where the open follow-up's answer lands in the draft, and which later question fills what.
  const parts = storyParts(storyType);
  const followUps = content.followUps ?? [];
  const openFollowUp = currentFollowUp !== undefined ? followUps[currentFollowUp] : undefined;
  const round = openFollowUp ? (openFollowUp.round ?? 1) : undefined;
  const roundQuestions = followUps
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.source !== "practice" && (f.round ?? 1) === round);
  const answering = openFollowUp && content.draft ? partForGap(openFollowUp.gap, parts) : undefined;
  const coming = new Map<string, number>();
  roundQuestions.forEach(({ f, i }, k) => {
    if (i === currentFollowUp || f.answer?.trim() || f.skipped) return;
    const part = partForGap(f.gap, parts);
    if (!coming.has(part)) coming.set(part, k + 1);
  });
  const justWritten = useJustWritten(content.draft);

  return (
    <>
      <header className="mt-1">
        <div className="flex items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="min-w-0 truncate text-sm text-slate-600">
            {/* A new story, not saved yet, sits under the story picker; a saved one under the prep. */}
            <Link
              href={storyId === null ? "/stories/new" : "/"}
              className="hover:text-slate-900 hover:underline"
            >
              {storyId === null ? "Build a story" : "Prep"}
            </Link>
            <span aria-hidden="true" className="mx-2 text-ink-300">
              /
            </span>
            <span>{storyType?.label ?? "Story"}</span>
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            <ViewTabs view={view} onChange={setView} />
            {menu && (
              <details className="relative" data-testid="story-menu">
                <summary
                  aria-label="More options"
                  className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-lg leading-none text-slate-600 hover:bg-ink-50 hover:text-slate-900 [&::-webkit-details-marker]:hidden"
                >
                  ⋯
                </summary>
                <div className="absolute right-0 z-10 mt-2 w-72 origin-top-right animate-pop rounded-[10px] bg-white p-4 shadow-lg ring-1 ring-ink-100">
                  {menu}
                </div>
              </details>
            )}
          </div>
        </div>
        <h1
          className="mt-6 max-w-4xl font-words text-4xl font-semibold leading-[1.15] tracking-[-0.01em] text-slate-900"
          data-testid="story-title"
        >
          {content.draft ? title : (storyType?.label ?? title)}
        </h1>
        <p
          className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600"
          data-testid="progress"
        >
          {metaLevel !== undefined && (
            <span className="flex items-center gap-2" data-testid="draft-level">
              <LevelMeter level={metaLevel} />
              <span>
                <span className="font-semibold text-slate-900">Level {metaLevel}</span>
                {levelsOn && `: ${levelInfo(metaLevel).name.toLowerCase()}`}
              </span>
            </span>
          )}
          {view === "story" && content.draft ? (
            <>
              <span>
                <span className="font-mono tabular-nums text-slate-900">{clock(track.seconds)}</span>{" "}
                spoken
              </span>
              <span>{track.words} words</span>
              <span>
                {busy === "grading"
                  ? "Grading…"
                  : grade
                    ? `Graded ${shortDate(grade.gradedAt)}`
                    : "Not graded yet"}
              </span>
            </>
          ) : (
            <span>{progressLabel(stage, coreAnswered, questions.length, content, storyType)}</span>
          )}
        </p>
      </header>

      {view === "build" ? (
        <div className="mt-10 grid animate-enter grid-cols-1 items-start gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-label="Question" className="min-w-0">
            {showExample && help === "full" && (
              <section
                className="mb-12 border-b border-ink-100 pb-12"
                data-testid="example-story"
                data-help={help}
              >
                <h2 className="text-sm font-semibold text-slate-900">
                  First, see one story climb from Level 1 to Level 3
                </h2>
                <div className="mt-4">
                  <ExampleLadder field={field} />
                </div>
              </section>
            )}
            {error && (
              <p role="alert" className="mb-6 rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}

            {currentCore && !content.imported ? (
              <CurrentQuestion
                intro={
                  storyType?.format === "intro" && coreAnswered === 0 && !content.linkedin
                    ? `${questions.length} short questions. Answer in plain notes, typed or spoken; the answer is written from your words.`
                    : undefined
                }
                eyebrow={
                  questions.length === 1
                    ? "Tell it your way"
                    : `Question ${coreAnswered + 1} of ${questions.length}`
                }
                sub={
                  questions.length > 1
                    ? fillsIn(
                        parts.find(
                          (p) => p.id === questions.find((q) => q.id === currentCore)?.part,
                        ),
                        storyType,
                      )
                    : "Rough notes or a minute of talking is plenty"
                }
                question={
                  inferredNow
                    ? inferredPathQuestion(inferredNow.source)
                    : questionFor(currentCore, storyType, content.asked, situation)
                }
                hint={hints[currentCore]}
                source={
                  inferredNow
                    ? `Started from your ${inferredNow.source === "resume" ? "resume" : "LinkedIn"}`
                    : undefined
                }
                joggers={
                  currentCore === "start" && !seed ? (
                    <OpeningHelp
                      amount={behavioral ? help : "full"}
                      joggers={
                        <Joggers
                          storyType={storyType}
                          situation={situation}
                          moments={moments}
                          disabled={busy !== null}
                          onPick={(text) => setInsert((n) => ({ text, n: (n?.n ?? 0) + 1 }))}
                        />
                      }
                      quickStart={
                        behavioral && (
                          <QuickStart
                            storyTypeId={storyTypeId}
                            situation={situation}
                            answerText={answerText}
                            disabled={busy !== null}
                            onPick={(pick) => setInsert((n) => ({ ...pick, n: (n?.n ?? 0) + 1 }))}
                          />
                        )
                      }
                    />
                  ) : undefined
                }
              >
                {!busy && canInferPath(content) && (
                  <button
                    type="button"
                    onClick={() => run([{ busy: "inferring", action: () => inferPath(sid()) }])}
                    className="mb-3 text-sm font-medium text-ink-700 hover:text-ink-900 hover:underline"
                    data-testid="infer-path"
                  >
                    Read it from my {hasResume ? "resume" : "LinkedIn profile"} instead
                  </button>
                )}
                <Composer
                  key={`core-${currentCore}-${inferredNow ? "inferred" : seedNow ? "seed" : "blank"}`}
                  size="lg"
                  initial={inferredNow?.text ?? (seedNow ? `${seedNow.moment}. ` : "")}
                  draftKey={inferredNow ? undefined : `${draftScope}:core-${currentCore}`}
                  insert={insert}
                  onTextChange={setAnswerText}
                  placeholder={
                    currentCore === "start" && guidedStart(targets, storyType)
                      ? `${GUIDED_START_PROMPTS.join("\n")}\n\nA line or two for each is plenty.`
                      : undefined
                  }
                  rows={currentCore === "start" && storyType?.format !== "intro" ? 6 : 4}
                  disabled={busy !== null}
                  help={questionHelp(
                    currentCore === "start" && storyType?.format !== "intro"
                      ? "telling"
                      : (questions.find((q) => q.id === currentCore)?.part ?? currentCore),
                    field,
                    situation.entry,
                  )}
                  submitLabel={
                    storyType?.format !== "intro" && questions.length === 1
                      ? "Write my rough draft"
                      : "Next"
                  }
                  onSubmit={(text) => submitCore(currentCore, text)}
                />
              </CurrentQuestion>
            ) : openFollowUp && currentFollowUp !== undefined ? (
              <CurrentQuestion
                intro={
                  openFollowUp.source !== "practice" &&
                  roundQuestions.every(({ f }) => !f.answer?.trim() && !f.skipped)
                    ? roundIntro(content, storyType, round ?? 1)
                    : undefined
                }
                eyebrow={
                  openFollowUp.source === "practice"
                    ? "From your practice answers"
                    : `Question ${roundQuestions.findIndex(({ i }) => i === currentFollowUp) + 1} of ${roundQuestions.length}`
                }
                sub={
                  openFollowUp.source !== "practice" && content.draft
                    ? fillsIn(partOfGap(openFollowUp.gap, storyType), storyType)
                    : undefined
                }
                question={openFollowUp.question}
                joggers={
                  openFollowUp.options?.length ? (
                    <TapOptions
                      options={openFollowUp.options}
                      answerText={answerText}
                      disabled={busy !== null}
                      onPick={(text, remove) =>
                        setInsert((n) => ({ text, n: (n?.n ?? 0) + 1, remove }))
                      }
                    />
                  ) : undefined
                }
              >
                <Composer
                  key={`follow-up-${currentFollowUp}`}
                  size="lg"
                  initial=""
                  draftKey={`${draftScope}:fu-${currentFollowUp}`}
                  insert={insert}
                  onTextChange={setAnswerText}
                  disabled={busy !== null}
                  submitLabel="Next"
                  help={questionHelp(openFollowUp.gap, field, situation.entry)}
                  onDontKnow={
                    openFollowUp.source !== "practice" ? () => skipOne(currentFollowUp) : undefined
                  }
                  onEstimate={
                    openFollowUp.source !== "practice" &&
                    asksForNumber(openFollowUp.question, openFollowUp.gap)
                      ? (text) => setInsert((n) => ({ text, n: (n?.n ?? 0) + 1 }))
                      : undefined
                  }
                  check={(text) =>
                    onlyStarters(text, openFollowUp.options) ? FINISH_STARTER_NOTE : null
                  }
                  onSubmit={(text) => submitFollowUp(currentFollowUp, text)}
                  onSkip={(typed) => skipRest(typed)}
                  skipLabel={content.draft ? "Skip the rest" : "Skip the rest and write it"}
                />
              </CurrentQuestion>
            ) : busy && busy !== "saving" ? (
              <Thinking>
                {busy === "reading"
                  ? "Reading your LinkedIn profile…"
                  : busy === "inferring"
                    ? `Reading your path from your ${hasResume ? "resume" : "LinkedIn profile"}…`
                    : busy === "probing" || busy === "leveling"
                      ? "Reading your answers for what's still thin…"
                      : busy === "writing"
                        ? writesRoughDraft(content, storyType)
                          ? "Writing a rough draft from your words…"
                          : "Writing the story from your answers…"
                        : busy === "grading"
                          ? "Grading the story…"
                          : "Working…"}
              </Thinking>
            ) : busy ? (
              <Thinking>Saving…</Thinking>
            ) : stage === "probe" ? (
              <ActionLine
                text={
                  content.followUps
                    ? "Next, a check for anything that's still thin."
                    : content.imported
                      ? "The prepared answer is in. Next, a look for gaps."
                      : "That's every question. Next, a look for gaps."
                }
                button="Get follow-up questions"
                onClick={() => run([{ busy: "probing", action: () => askFollowUps(sid()) }])}
              />
            ) : stage === "write" ? (
              <ActionLine
                text="That's everything needed to write it."
                button="Write my story"
                onClick={() => run([{ busy: "writing", action: () => writeDraft(sid()) }])}
              />
            ) : stage === "drafted" ? (
              <ActionLine
                text={
                  level !== undefined && gradeIsCurrent(content)
                    ? `The story is at Level ${level}: ${levelInfo(level).name.toLowerCase()}.`
                    : "The story is written."
                }
                button="See the story and its score"
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

            {showExample && help !== "full" && (
              <details
                className="group mt-10 border-t border-ink-100 pt-6"
                data-testid="example-story"
                data-help={help}
              >
                <summary className="cursor-pointer text-sm font-medium text-ink-700 hover:text-ink-900">
                  See an example story climb from Level 1 to 3
                </summary>
                <div className="mt-4">
                  <ExampleLadder field={field} />
                </div>
              </details>
            )}

            <History
              linkedin={content.linkedin}
              items={[
                ...(content.imported
                  ? [
                      {
                        key: "imported",
                        asked: "The answer you prepared before",
                        answer: content.imported.text,
                        source: content.imported.fileName
                          ? `From ${content.imported.fileName}`
                          : undefined,
                      },
                    ]
                  : []),
                ...askedCore
                  .filter((q) => q.id !== currentCore || Boolean(content.imported))
                  .map((q) => {
                    const inferred = q.id === "path" ? content.inferredPath : undefined;
                    return {
                      key: `core-${q.id}`,
                      asked: inferred
                        ? inferredPathQuestion(inferred.source)
                        : questionFor(q.id, storyType, content.asked, situation),
                      answer: content.answers[q.id],
                      source: content.roleMap?.seeded?.includes(q.id)
                        ? "From your role map"
                        : content.linkedin?.prefilled.includes(q.id)
                          ? "From your LinkedIn"
                          : inferred
                            ? `Started from your ${inferred.source === "resume" ? "resume" : "LinkedIn"}`
                            : undefined,
                      editing: editing?.kind === "core" && editing.id === q.id,
                      onEdit: () => setEditing({ kind: "core", id: q.id }),
                      onSubmit: (text: string) => submitCore(q.id, text),
                    };
                  }),
                ...followUps.flatMap((f, index) =>
                  index === currentFollowUp ||
                  (currentFollowUp !== undefined && index > currentFollowUp)
                    ? []
                    : [
                        {
                          key: `fu-${index}`,
                          label: f.source === "practice" ? "From practice" : undefined,
                          asked: f.question,
                          answer: f.answer,
                          skipped: f.skipped && !f.answer?.trim(),
                          editing: editing?.kind === "followUp" && editing.index === index,
                          onEdit: () => setEditing({ kind: "followUp", index }),
                          onSubmit: (text: string) => submitFollowUp(index, text),
                        },
                      ],
                ),
              ].reverse()}
              disabled={busy !== null}
              onCancel={() => setEditing(null)}
            />
          </section>

          <aside className="flex flex-col gap-10 lg:sticky lg:top-6">
            {storyType?.format === "intro" ? (
              <AnswerChecklist
                content={content}
                storyType={storyType}
                currentCore={currentCore}
                onShowStory={() => setView("story")}
              />
            ) : (
              <DraftTrack
                draft={content.draft}
                storyType={storyType}
                answering={answering}
                coming={coming}
                flash={justWritten}
              />
            )}
            {(content.draft || storyType?.format === "intro") && beside}
            {storyType?.format === "intro" && (canUpload || content.roleMap) && (
              <section className="border-t border-ink-100 pt-6">
                <RoleMapCard
                  storyId={storyId ?? ""}
                  content={content}
                  prominent={
                    canUpload && suggestRoleMap(content.answers[questions[0]?.id], content.roleMap)
                  }
                />
                {canUpload && (
                  <details className="group mt-4" data-testid="start-from-file">
                    <summary className="cursor-pointer text-sm text-slate-600">
                      Have a LinkedIn PDF or a prepared answer?{" "}
                      <span className="font-medium text-ink-700 group-open:hidden">
                        Start from a file
                      </span>
                    </summary>
                    <div className="mt-3 flex flex-col gap-3">
                      {!content.linkedin && (
                        <UploadOption
                          testId="upload-linkedin"
                          lead="LinkedIn profile:"
                          text="click More, then Save to PDF. What it answers is filled in for you."
                          accept=".pdf"
                          button="Upload profile"
                          disabled={busy !== null}
                          onUpload={submitLinkedIn}
                        />
                      )}
                      <UploadOption
                        testId="upload-prepared"
                        lead="Prepared answer:"
                        text="a Word (.docx) or text file. It's reviewed instead of asking every question."
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
        <StoryView
          content={content}
          storyType={storyType}
          field={field}
          paragraphs={paragraphs}
          busy={busy}
          error={error}
          level={level}
          levelLeads={levelLeads}
          weak={weak}
          draftScope={draftScope}
          execMode={execMode}
          recruiterScreen={recruiterScreen}
          uses={uses}
          onRun={run}
          sid={sid}
          onContent={setContent}
          onShowBuild={() => setView("build")}
          onClimb={climb}
          onStrengthen={strengthen}
          onAnswer={submitFollowUp}
          onSkipOne={skipOne}
          after={
            <>
              {content.draft && finishBase && behavioral && (
                <FinishLineBar
                  line={finishLine({
                    ...finishBase,
                    written: finishBase.written + 1,
                    doneToday:
                      finishBase.doneToday ||
                      writtenOn(content.draft.writtenAt, finishBase.today, finishBase.timeZone),
                  })}
                  afterStory
                />
              )}
              {content.draft && nextUp}
              {afterStory}
            </>
          }
        />
      )}
    </>
  );
}

const VIEWS = [
  { id: "build", label: "Build" },
  { id: "story", label: "Story and score" },
] as const;

type View = (typeof VIEWS)[number]["id"];

type Step = { busy: Exclude<Busy, null>; action: () => Promise<BuilderResult> };

// Build | Story and score, as underlined tabs. The underline slides between them (the same object
// moving, not one disappearing and another appearing); before it's measured, the selected tab
// draws its own.
function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const tabs = useRef<Partial<Record<View, HTMLButtonElement | null>>>({});
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const el = tabs.current[view];
      if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [view]);
  return (
    <div role="tablist" aria-label="Story views" className="relative flex gap-6 text-sm">
      {bar && (
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-0.5 rounded-full bg-ink-900 transition-[translate,width] duration-250 ease-in-out"
          style={{ translate: `${bar.left}px 0`, width: bar.width }}
        />
      )}
      {VIEWS.map((v) => (
        <button
          key={v.id}
          ref={(el) => {
            tabs.current[v.id] = el;
          }}
          type="button"
          role="tab"
          aria-selected={view === v.id}
          onClick={() => onChange(v.id)}
          className={`relative pb-2 pt-1 font-medium transition-colors duration-200 ${
            view === v.id
              ? `text-slate-900 ${bar ? "" : "shadow-[inset_0_-2px_0_var(--color-ink-900)]"}`
              : "text-slate-600 hover:text-slate-900"
          }`}
          data-testid={`tab-${v.id}`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

// The line under the title on the Build view: where the story stands.
function progressLabel(
  stage: ReturnType<typeof builderStage>,
  coreAnswered: number,
  coreTotal: number,
  content: StoryContent,
  storyType: StoryType | undefined,
): string {
  const questions = (n: number) => `${n} ${n === 1 ? "question" : "questions"}`;
  const written = content.draft
    ? isRoughDraft(content) || stage === "probe"
      ? "Rough draft written"
      : "Draft written"
    : undefined;
  switch (stage) {
    case "core":
      return coreTotal === 1 ? "Not written yet" : `${coreAnswered} of ${coreTotal} answered`;
    case "probe":
      return written ?? "Questions done";
    case "follow_ups": {
      const open = pendingFollowUps(content);
      const levelUp = content.levelUp?.reached === undefined ? content.levelUp : undefined;
      const target =
        levelUp?.target ??
        (usesLevels(storyType, content) && content.draft
          ? Math.min(TOP_LEVEL, (storyLevel(content, storyType) ?? 1) + 1)
          : undefined);
      const rest = target ? `${questions(open)} to Level ${target}` : `${questions(open)} to go`;
      return written ? `${written} · ${rest}` : rest;
    }
    case "write":
      return "Ready to write";
    case "drafted":
      return "Draft written";
  }
}

// The coach's line over the first question of a round of follow-ups.
function roundIntro(content: StoryContent, storyType: StoryType | undefined, round: number) {
  const levelUp = content.levelUp;
  if (levelUp && round === levelUp.round) {
    const next = levelInfo(levelUp.target);
    return `This round gets it to Level ${levelUp.target}: ${next.name.toLowerCase()}. ${next.lesson} A few questions about just that.`;
  }
  if (round > 1) return "A few more, so the numbers and examples carry it.";
  if (content.draft && usesLevels(storyType, content)) {
    return "A rough draft is written from your words. That's Level 1: it happened. A few quick questions get it to Level 2, so it proves something. Easiest first.";
  }
  if (content.draft && storyType?.format !== "intro") {
    return "A rough draft is written from your words. A few quick questions make it stronger. Easiest first.";
  }
  return "A few quick follow-ups, easiest first.";
}

// "Graded Nov 21", from the ISO date, so the server and the browser print the same thing.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return m && d ? `${MONTHS[m - 1]} ${d}` : "";
}

// "Fills in the result", over a question: the part of the story its answer goes into.
function fillsIn(part: StoryPart | undefined, storyType: StoryType | undefined): string | undefined {
  if (!part) return undefined;
  return storyType?.format === "intro"
    ? `Fills in: ${part.label}`
    : `Fills in the ${trackLabel(part).toLowerCase()}`;
}

function seedHint(seed: NonNullable<StoryContent["seed"]>): string {
  const quote = seed.quote.replace(/[.;,\s]+$/, "");
  const from = quote ? `From ${seed.sourceLabel || "your resume"}: "${quote}". ` : "";
  return `${from}It starts from this moment${seed.question ? `, ${seed.question.replace(/\?$/, "")}` : ""}. Make it your own: where you were, your role and what was going on.`;
}

// The question being answered, as the page's heading, in the words an interviewer would say it:
// which question it is and the part of the story it fills in above it, the answer box under it.
function CurrentQuestion({
  intro,
  eyebrow,
  sub,
  question,
  hint,
  source,
  joggers,
  children,
}: {
  // The coach's line opening a round of questions.
  intro?: string;
  eyebrow: string;
  sub?: string;
  question: string;
  // A nudge under the question, e.g. which target job the story should fit.
  hint?: string;
  // Where a prefilled answer came from.
  source?: string;
  // Memory joggers and taps to start from.
  joggers?: React.ReactNode;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} data-testid="question-block">
      {intro && (
        <p
          className="mb-8 max-w-2xl animate-enter text-[0.9375rem] leading-relaxed text-slate-700"
          data-testid="round-intro"
        >
          {intro}
        </p>
      )}
      <p className="text-sm">
        <span className="font-semibold text-accent-700">{eyebrow}</span>
        {sub && <span className="ml-3 text-slate-600">{sub}</span>}
      </p>
      <h2
        id={id}
        key={question}
        className="mt-3 max-w-3xl animate-enter font-words text-3xl font-medium leading-[1.25] text-slate-900"
        data-testid="current-question"
      >
        {question}
      </h2>
      {hint && (
        <p
          className="mt-4 max-w-2xl text-[0.9375rem] leading-relaxed text-slate-600"
          data-testid="question-hint"
        >
          {hint}
        </p>
      )}
      {source && <p className="mt-2 text-sm text-slate-600">{source}</p>}
      {joggers && <div className="mt-6 flex flex-col gap-5">{joggers}</div>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

// What's been asked and answered, newest first, under the question being answered.
type HistoryItem = {
  key: string;
  // In place of "Asked", e.g. "From practice".
  label?: string;
  asked: string;
  answer: string | undefined;
  // Where a prefilled answer came from, e.g. "From your LinkedIn".
  source?: string;
  // Passed on with "I don't know this".
  skipped?: boolean;
  editing?: boolean;
  onEdit?: () => void;
  onSubmit?: (text: string) => void;
};

function History({
  items,
  linkedin,
  disabled,
  onCancel,
}: {
  items: HistoryItem[];
  linkedin: StoryContent["linkedin"];
  disabled: boolean;
  onCancel: () => void;
}) {
  const shown = items.filter((i) => i.answer?.trim() || i.skipped || i.editing);
  if (shown.length === 0 && !linkedin) return null;
  return (
    <section
      aria-label="Answers so far"
      className="mt-14 border-t border-ink-100 pt-8"
      data-testid="answers-so-far"
    >
      {linkedin && (
        <p className="mb-8 text-sm text-slate-600">
          {linkedin.prefilled.length > 0
            ? "Read from your LinkedIn profile: what it answers is filled in below. Edit anything that's off."
            : "Your LinkedIn profile was read, but it didn't answer these questions directly."}
        </p>
      )}
      <ol className="flex flex-col gap-9">
        {shown.map((item) => (
          <li
            key={item.key}
            className="grid animate-enter grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-[5.5rem_minmax(0,1fr)]"
          >
            <p className="pt-0.5 text-sm text-slate-500">{item.label ?? "Asked"}</p>
            <p className="text-[0.9375rem] leading-relaxed text-slate-700">{item.asked}</p>
            <p className="mt-2 pt-1 text-sm text-slate-500 sm:mt-0">
              {item.skipped && !item.editing ? "Skipped" : "You said"}
            </p>
            <div className="min-w-0">
              {item.editing && item.onSubmit ? (
                <Composer
                  initial={item.answer ?? ""}
                  disabled={disabled}
                  submitLabel="Save"
                  onSubmit={item.onSubmit}
                  onCancel={onCancel}
                />
              ) : item.skipped ? (
                <p className="pt-0.5 text-[0.9375rem] text-slate-500">
                  Left out of the story.{" "}
                  {item.onEdit && (
                    <button
                      type="button"
                      onClick={item.onEdit}
                      disabled={disabled}
                      className="font-medium text-slate-700 hover:text-slate-900 hover:underline disabled:opacity-50"
                    >
                      Answer it after all
                    </button>
                  )}
                </p>
              ) : (
                <>
                  <p className="whitespace-pre-wrap font-words text-lg leading-relaxed text-slate-900">
                    {item.answer}
                  </p>
                  <p className="mt-1.5 flex flex-wrap gap-x-4 text-sm">
                    {item.source && <span className="text-slate-500">{item.source}</span>}
                    {item.onEdit && (
                      <button
                        type="button"
                        onClick={item.onEdit}
                        disabled={disabled}
                        className="text-slate-500 hover:text-slate-900 hover:underline disabled:opacity-50"
                      >
                        Edit
                      </button>
                    )}
                  </p>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Beside the questions for "Tell me about yourself": which parts have answers so far.
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
    <section data-testid="answer-checklist">
      <h2 className="text-sm font-semibold text-slate-900">Answers so far</h2>
      <ol className="mt-4 flex flex-col gap-2.5 text-sm">
        {storyParts(storyType).map((part) => {
          const asked = questions.filter((q) => q.part === part.id);
          if (asked.length === 0) return null;
          const done =
            Boolean(content.imported) || asked.every((q) => content.answers[q.id]?.trim());
          const current = asked.some((q) => q.id === currentCore);
          return (
            <li key={part.id} className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className={`size-2.5 shrink-0 rounded-full border transition-colors duration-300 ${
                  current
                    ? "border-accent-700 bg-accent-700"
                    : done
                      ? "border-ink-700 bg-ink-700"
                      : "border-dashed border-ink-300"
                }`}
              />
              <span
                className={
                  current ? "font-medium text-slate-900" : done ? "text-slate-800" : "text-slate-500"
                }
              >
                {part.label}
              </span>
              {current && <span className="text-xs font-semibold text-accent-700">Answering now</span>}
            </li>
          );
        })}
      </ol>
      {followUps.length > 0 && (
        <p className="mt-4 text-sm text-slate-600">
          Follow-ups: {followUpsAnswered} of {followUps.length} answered
        </p>
      )}
      <p className="mt-4 text-sm text-slate-600">
        {content.draft ? (
          <button type="button" onClick={onShowStory} className="link">
            See the story and its score
          </button>
        ) : (
          "Once these are answered, the story is written from your words and graded."
        )}
      </p>
    </section>
  );
}

// The opening question's memory joggers and Quick start taps, as much as the user still needs (see
// help-fade.ts): all of it on the first story, Quick start folded on the second, both behind one
// "Need a nudge?" tap after that.
function OpeningHelp({
  amount,
  joggers,
  quickStart,
}: {
  amount: HelpAmount;
  joggers: React.ReactNode;
  quickStart: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (amount === "full" || open) {
    return (
      <>
        {joggers}
        {quickStart}
      </>
    );
  }
  const button = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-expanded={false}
      className="link self-start text-sm"
      data-testid="need-a-nudge"
    >
      {amount === "some" ? "Quick start: tap what fits" : "Need a nudge?"}
    </button>
  );
  if (amount === "some") {
    return (
      <>
        {joggers}
        {quickStart && button}
      </>
    );
  }
  return button;
}

// A choice to tap under a question, and the same choice once it's in the answer.
const CHOICE =
  "rounded-lg bg-white px-3 py-1.5 text-left text-sm text-slate-800 ring-1 ring-ink-200 transition-colors hover:bg-ink-50 hover:ring-ink-300 disabled:opacity-50";
const CHOSEN =
  "rounded-lg bg-accent-50 px-3 py-1.5 text-left text-sm text-ink-900 ring-1 ring-accent-700 transition-colors disabled:opacity-50";

// Under the opening question of a behavioral story: a few kinds of moment to jog their memory, and
// moments the story finder read from their resume or LinkedIn. A tap starts the answer with it.
function Joggers({
  storyType,
  situation,
  moments,
  disabled,
  onPick,
}: {
  storyType: StoryType | undefined;
  situation: Situation;
  moments: JoggerMoment[];
  disabled: boolean;
  onPick: (text: string) => void;
}) {
  const general = joggersFor(storyType, situation);
  if (general.length === 0 && moments.length === 0) return null;
  return (
    <div className="flex flex-col gap-4" data-testid="joggers">
      {moments.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600">
            From {moments[0].sourceLabel || "your resume"}, one of these might fit
          </p>
          <div className="flex flex-wrap gap-2" data-stagger>
            {moments.map((m) => (
              <button
                key={m.moment}
                type="button"
                disabled={disabled}
                onClick={() => onPick(`${m.moment}. `)}
                className={CHOICE}
                title={m.quote ? `"${m.quote}"` : undefined}
              >
                {m.moment}
              </button>
            ))}
          </div>
        </div>
      )}
      {general.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600">
            {moments.length > 0 ? "Or think of" : "Stuck on which one? Think of"}
          </p>
          <div className="flex flex-wrap gap-2" data-stagger>
            {general.map((j) => (
              <button
                key={j}
                type="button"
                disabled={disabled}
                onClick={() => onPick(`${j}: `)}
                className={CHOICE}
              >
                {j}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Under the opening question of a behavioral story: three rows of taps (what was at stake, their
// part, how it ended), one pick per row, that start the answer as notes. Picking another option in
// a row swaps its line; tapping the picked one again takes it out.
function QuickStart({
  storyTypeId,
  situation,
  answerText,
  disabled,
  onPick,
}: {
  storyTypeId: string | null;
  situation: Situation;
  answerText: string;
  disabled: boolean;
  onPick: (pick: { text: string; remove?: boolean; replace?: string }) => void;
}) {
  const rows = quickStartRows(storyTypeId, {
    stakes: stakesFor(situation),
    parts: partsFor(situation),
  });
  const anyPicked = rows.some((row) => quickPicked(row, answerText));
  return (
    <div className="flex flex-col gap-3" data-testid="quick-start">
      <p className="text-sm font-semibold text-slate-900">Quick start: tap what fits</p>
      <div className="grid grid-cols-1 gap-y-2 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-2.5">
        {rows.map((row) => {
          const picked = quickPicked(row, answerText);
          return (
            <Fragment key={row.id}>
              <span className="pt-1.5 text-sm text-slate-600">{row.label}</span>
              <span role="radiogroup" aria-label={row.label} className="flex flex-wrap gap-1.5">
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
                      className={on ? CHOSEN : CHOICE}
                      data-testid={`quick-${row.id}`}
                    >
                      {on && <span aria-hidden="true">✓ </span>}
                      {o}
                    </button>
                  );
                })}
              </span>
            </Fragment>
          );
        })}
      </div>
      <p className="text-sm text-slate-600" aria-live="polite">
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
    <div className="flex flex-col gap-2" data-testid="tap-options">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <span className="text-sm text-slate-600">Start from</span>
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
                className={on ? CHOSEN : CHOICE}
              >
                {on && <span aria-hidden="true">✓ </span>}
                {o}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-sm text-slate-600" aria-live="polite">
        {picked.length
          ? "Added to your answer below. Finish it with a sentence in your words, then tap Next."
          : "Tap one to start, then add a sentence in your words."}
      </p>
    </div>
  );
}

// The story part a follow-up's gap lands in. An unknown gap goes to where the story starts, after
// the optional opening principle.
function partForGap(gap: string, parts: readonly StoryPart[]): string {
  const start = parts.find((p) => p.id !== "principle") ?? parts[0];
  return parts.find((p) => p.id === gap)?.id ?? GAP_TO_PART[gap] ?? start.id;
}

function partOfGap(gap: string, storyType: StoryType | undefined): StoryPart | undefined {
  const parts = storyParts(storyType);
  if (!gap || (!parts.some((p) => p.id === gap) && !GAP_TO_PART[gap])) return undefined;
  return parts.find((p) => p.id === partForGap(gap, parts));
}

const TEXT_BUTTON =
  "min-h-10 rounded-lg px-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50";

function Composer({
  initial,
  insert,
  onTextChange,
  placeholder,
  rows = 3,
  size = "md",
  autoFocus = true,
  disabled,
  submitLabel,
  onSubmit,
  onCancel,
  onSkip,
  skipLabel,
  draftKey,
  check,
  help,
  onDontKnow,
  onEstimate,
}: {
  initial: string;
  // Text to add to the box (a memory jogger the user tapped); a new `n` adds it again.
  insert?: Insert;
  // Told what's in the box as it changes.
  onTextChange?: (text: string) => void;
  placeholder?: string;
  rows?: number;
  // "lg" for the question being answered; "sm" in a margin note.
  size?: "lg" | "md" | "sm";
  // Focus the box when it opens.
  autoFocus?: boolean;
  disabled: boolean;
  submitLabel: string;
  onSubmit: (answer: string) => void;
  onCancel?: () => void;
  // Told what's typed, so it can be kept rather than dropped.
  onSkip?: (typed: string) => void;
  skipLabel?: string;
  // Keeps what's typed (not yet sent) in this tab under this key, and brings it back.
  draftKey?: string;
  // A nudge shown once before sending, e.g. when the answer is only tapped starters; sending the
  // same text again goes through.
  check?: (answer: string) => string | null;
  // "Show a good answer", and where to look when they don't know.
  help?: QuestionHelp;
  // "I don't know this": passes on the question.
  onDontKnow?: () => void;
  // For a number question: starts the answer as a labelled estimate.
  onEstimate?: (text: string) => void;
}) {
  const [text, setText] = useState(initial);
  const [talking, setTalking] = useState(false);
  const [open, setOpen] = useState<null | "example" | "unsure">(null);
  const toggle = (which: "example" | "unsure") => setOpen((o) => (o === which ? null : which));
  const ref = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();

  useEffect(() => {
    if (!autoFocus) return;
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [autoFocus]);

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

  const [nudged, setNudged] = useState<string | null>(null);
  const nudge = nudged !== null && nudged === text ? check?.(text) : null;

  function send(answer: string) {
    if (check?.(answer) && nudged !== answer) {
      setNudged(answer);
      ref.current?.focus({ preventScroll: true });
      return;
    }
    if (draftKey) writeKept(draftKey, "");
    onSubmit(answer);
  }

  const canSubmit =
    !disabled &&
    !talking &&
    text.trim().length > 0 &&
    answerProblem(text, MAX_ANSWER_LENGTH) === null;
  const sm = size === "sm";

  return (
    <form
      className="flex flex-col gap-3"
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
        placeholder={placeholder ?? (sm ? "Type, or press Talk and say it" : "Type, or press Talk and say it. Rough notes are fine.")}
        className={`w-full resize-y rounded-[10px] border border-ink-200 bg-white text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 placeholder:font-sans placeholder:text-slate-400 focus:border-accent-700 focus:ring-4 focus:ring-accent-700/10 ${
          size === "lg"
            ? "px-5 py-4 font-words text-lg leading-relaxed placeholder:text-base"
            : sm
              ? "px-3 py-2.5 font-words text-base leading-relaxed placeholder:text-sm"
              : "px-4 py-3 font-words text-base leading-relaxed placeholder:text-[0.9375rem]"
        }`}
      />
      <AnswerLimit text={text} max={MAX_ANSWER_LENGTH} />
      {nudge && (
        <p
          role="status"
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
          data-testid="finish-starter"
        >
          {nudge}
        </p>
      )}
      {sm ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <button type="submit" disabled={!canSubmit} className="btn-next">
            {disabled ? "Saving…" : submitLabel}
          </button>
          <MicButton
            disabled={disabled}
            onActiveChange={setTalking}
            onText={(spoken) => setText((t) => appendSpoken(t, spoken))}
          />
          {onSkip && !talking && (
            <button
              type="button"
              onClick={() => {
                if (draftKey) writeKept(draftKey, "");
                onSkip(text);
              }}
              disabled={disabled}
              className={TEXT_BUTTON}
              data-testid="skip-follow-ups"
            >
              {skipLabel ?? "Skip"}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <div className="mr-auto flex flex-wrap items-center gap-3">
            <MicButton
              disabled={disabled}
              onActiveChange={setTalking}
              onText={(spoken) => setText((t) => appendSpoken(t, spoken))}
            />
            {/* Simulated users typed and typed without sending (2026-11-08): once there's text,
                say how to send it. */}
            {!talking && canSubmit ? (
              <span className="text-xs font-medium text-ink-700" data-testid="send-hint">
                Done? Tap {submitLabel}
                <span className="hidden sm:inline">
                  {" "}
                  or press <kbd className="font-mono">⌘/Ctrl Enter</kbd>
                </span>
                .
              </span>
            ) : !talking ? (
              <kbd className="hidden font-mono text-xs text-slate-500 sm:inline">⌘/Ctrl Enter</kbd>
            ) : null}
          </div>
          {help?.example && !talking && (
            <button
              type="button"
              onClick={() => toggle("example")}
              aria-expanded={open === "example"}
              className={TEXT_BUTTON}
              data-testid="show-example"
            >
              Show a good answer
            </button>
          )}
          {onDontKnow && !talking && (
            <button
              type="button"
              onClick={() => toggle("unsure")}
              aria-expanded={open === "unsure"}
              className={TEXT_BUTTON}
              data-testid="dont-know"
            >
              {onEstimate ? "I don't remember the number" : "I don't know this"}
            </button>
          )}
          {onSkip && !talking && (
            <button
              type="button"
              onClick={() => {
                if (draftKey) writeKept(draftKey, "");
                onSkip(text);
              }}
              disabled={disabled}
              className={TEXT_BUTTON}
              data-testid="skip-follow-ups"
            >
              {skipLabel ?? "Skip the rest"}
            </button>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel} className={TEXT_BUTTON}>
              Cancel
            </button>
          )}
          <button type="submit" disabled={!canSubmit} className="btn-next ml-1">
            {disabled ? "Saving…" : submitLabel}
          </button>
        </div>
      )}
      {open === "example" && help?.example && (
        <p className="animate-enter rounded-md bg-ink-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-900">An example, not your facts: </span>
          {help.example}
        </p>
      )}
      {open === "unsure" && onDontKnow && (
        <div className="flex animate-enter flex-col items-start gap-3 rounded-md bg-ink-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
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
                    className={CHOICE}
                  >
                    {starter}
                  </button>
                ))}
              </div>
              <p>
                Want the real figure later? Check a dashboard, a performance review or an old
                email. Or skip it and it&apos;s left out.
              </p>
            </>
          ) : (
            <>
              <p>{help?.whereToLook ?? DEFAULT_WHERE_TO_LOOK}</p>
              <p>A rough answer or a labelled estimate is fine. Or skip it and it&apos;s left out.</p>
            </>
          )}
          <button
            type="button"
            onClick={onDontKnow}
            disabled={disabled}
            className="btn-secondary"
            data-testid="skip-one"
          >
            Skip this question
          </button>
        </div>
      )}
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
        <Link href={href} className="link">
          See the role profile
        </Link>
      </p>
    );
  }
  if (!prominent) {
    return (
      <p className="text-sm text-slate-600" data-testid="role-map-link">
        Want words for what you did?{" "}
        <Link href={href} className="link">
          Map my role
        </Link>
      </p>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3" data-testid="role-map-card">
      <p className="text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Not sure how to describe your role?</span> Map
        it first, and these answers are filled in from it.
      </p>
      <Link href={href} className="btn-secondary">
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
      className="flex flex-col gap-2.5"
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
      <input
        id={fieldId}
        name="file"
        type="file"
        accept={accept}
        disabled={disabled}
        className="min-w-0 text-sm text-slate-600"
      />
      <button type="submit" disabled={disabled} className="btn-secondary self-start">
        {button}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
    </form>
  );
}

function Thinking({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      aria-busy="true"
      className="flex animate-fade items-center gap-2.5 text-[0.9375rem] text-slate-700"
    >
      <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-accent-700" />
      {children}
    </p>
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
    <div className="flex animate-enter flex-col items-start gap-4">
      <p className="max-w-2xl text-lg text-slate-800">{text}</p>
      <div className="flex flex-wrap gap-3">
        {extra && (
          <button type="button" onClick={extra.onClick} className="btn-next">
            {extra.button}
          </button>
        )}
        <button type="button" onClick={onClick} className={secondary ? "btn-secondary" : "btn-next"}>
          {button}
        </button>
      </div>
    </div>
  );
}

// True for a moment after the written story changes (a draft or a rewrite just landed), so the
// draft beside the questions can pulse once to say so. Not on first load.
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

// Where each graded criterion sits on the story, for its note in the margin. "Tell me about
// yourself" criteria are named after their parts; its thread runs through the whole answer.
const CRITERION_PART: Record<string, string> = {
  context: "situation",
  ownership: "actions",
  actions: "actions",
  result: "result",
  reflection: "reflection",
  thread: END_OF_STORY,
};

// The Story and score view (design review 2026-11-23, fix 3): the story as a script on its talk
// track, with the coach's notes in the margin beside the paragraph each is about, like comments in
// a document. Then what to do with the story, and its score. Every note comes from the grade the
// story already has, or questions already asked: no extra model step.
function StoryView({
  content,
  storyType,
  field,
  paragraphs,
  busy,
  error,
  level,
  levelLeads,
  weak,
  draftScope,
  execMode,
  recruiterScreen,
  uses,
  onRun,
  sid,
  onContent,
  onShowBuild,
  onClimb,
  onStrengthen,
  onAnswer,
  onSkipOne,
  after,
}: {
  content: StoryContent;
  storyType: StoryType | undefined;
  field: FieldId | null;
  paragraphs: string[];
  busy: Busy;
  error: string | null;
  level: StoryLevel | undefined;
  levelLeads: boolean;
  weak: WeakPart | undefined;
  draftScope: string;
  execMode: boolean;
  recruiterScreen: boolean;
  // More rows for "Use this story", e.g. tailoring About me for each job.
  uses?: React.ReactNode;
  onRun: (steps: Step[]) => void;
  sid: () => string;
  onContent: (content: StoryContent) => void;
  onShowBuild: () => void;
  onClimb: () => void;
  onStrengthen: () => void;
  onAnswer: (index: number, answer: string) => void;
  onSkipOne: (index: number) => void;
  after?: React.ReactNode;
}) {
  const draft = content.draft;
  const [showWhy, setShowWhy] = useState(false);
  const [showingChanges, setShowingChanges] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);
  // The level-up question the user picked to answer; the first one until they pick.
  const [chosen, setChosen] = useState<number | null>(null);
  const levelsOn = usesLevels(storyType, content);
  const grade = gradeIsCurrent(content) ? content.grade : undefined;
  const where = nextLevelGaps(content, storyType);
  const spot = useSpot(draft?.writtenAt, where?.gaps ?? []);
  const disabled = busy !== null;
  const asks = inlineLevelQuestions(content);

  // The notes in the margin, by the part they sit beside. Numbered notes (something to do) come
  // first, in story order; then what already works.
  const notes: Record<string, React.ReactNode[]> = {};
  const refs: Record<string, number[]> = {};
  const marked = new Set<string>();
  const add = (part: string, node: React.ReactNode) => (notes[part] ??= []).push(node);
  const order = [...storyParts(storyType).map((p) => p.id), END_OF_STORY];
  const inOrder = (part: string) => order.indexOf(part);
  // Something to do, numbered in story order: the level-up questions waiting on answers, or what
  // the next level needs.
  const todo: { part: string; note: (num: number) => React.ReactNode }[] = [];
  if (draft && asks.length > 0) {
    const sorted = [...asks].sort((a, b) => inOrder(a.part) - inOrder(b.part));
    const open = sorted.some((q) => q.index === chosen) ? chosen : sorted[0].index;
    for (const q of sorted) {
      todo.push({
        part: q.part,
        note: (num) =>
          q.index === open ? (
            <InlineAsk
              key={`ask-${q.index}`}
              num={num}
              q={q}
              target={content.levelUp?.target ?? 2}
              disabled={disabled}
              draftScope={draftScope}
              focus={chosen !== null}
              onAnswer={onAnswer}
              onSkip={onSkipOne}
            />
          ) : (
            <AskButton
              key={`ask-${q.index}`}
              num={num}
              q={q}
              disabled={disabled}
              onChoose={() => setChosen(q.index)}
            />
          ),
      });
    }
  } else if (draft && levelsOn && where?.next && spot.revealed) {
    for (const gap of where.gaps) {
      todo.push({
        part: gapPart(gap, draft.parts),
        note: (num) => <GapNote key={`gap-${gap.id}`} num={num} gap={gap} />,
      });
    }
    todo.sort((a, b) => inOrder(a.part) - inOrder(b.part));
  }
  todo.forEach((t, i) => {
    (refs[t.part] ??= []).push(i + 1);
    marked.add(t.part);
    add(t.part, t.note(i + 1));
  });
  if (draft && weak) {
    const part = draft.parts[weak.id]?.trim() ? weak.id : END_OF_STORY;
    marked.add(part);
    add(
      part,
      <WeakPartCallout
        key="weak"
        part={weak}
        disabled={disabled}
        busy={busy === "probing"}
        onAsk={() => onRun([{ busy: "probing", action: () => askAboutWeakPart(sid()) }])}
      />,
    );
  }
  if (draft && grade) {
    // One note a part, named after the part: the Action is graded twice (your part, and the steps
    // and choices), and two notes saying so pushed the rest of the margin down.
    const criteria = gradingCriteria(storyType);
    const parts = storyParts(storyType);
    const seen = new Set<string>();
    for (const c of grade.criteria) {
      if (c.score < 4) continue;
      const part = CRITERION_PART[c.id] ?? c.id;
      const at = draft.parts[part]?.trim() ? part : END_OF_STORY;
      if (seen.has(at)) continue;
      seen.add(at);
      const shown = parts.find((p) => p.id === at);
      const label = shown ? trackLabel(shown) : (criteria.find((x) => x.id === c.id)?.label ?? c.id);
      add(at, <StrongNote key={`ok-${c.id}`} label={label} note={c.note} />);
    }
  }
  const margin = (part: string) =>
    notes[part] && <div className="flex flex-col gap-6">{notes[part]}</div>;

  // After a level-up, the rewrite shown as changes from the draft before it.
  const before =
    showingChanges && content.levelUp?.reached !== undefined ? content.levelUp.before : undefined;
  const changes =
    before && draft
      ? Object.fromEntries(
          storyParts(storyType)
            .filter((p) => draft.parts[p.id]?.trim())
            .map((p) => [p.id, wordDiff(before[p.id] ?? "", draft.parts[p.id] ?? "")]),
        )
      : undefined;

  const lead = draft && (
    <div className="flex flex-col gap-5" data-testid="story-lead">
      <CoachRead
        content={content}
        storyType={storyType}
        grading={busy === "grading"}
        disabled={disabled}
        onGrade={() => onRun([{ busy: "grading", action: () => gradeDraft(sid()) }])}
      />
      <LevelStep
        content={content}
        storyType={storyType}
        spot={spot}
        busy={
          busy === "leveling"
            ? "asking"
            : busy === "writing" && content.levelUp && content.levelUp.reached === undefined
              ? "writing"
              : null
        }
        disabled={disabled}
        showingChanges={showingChanges}
        exampleOpen={exampleOpen}
        onLevelUp={onClimb}
        onDismiss={() => onRun([{ busy: "saving", action: () => dismissLevelUp(sid()) }])}
        onShowQuestions={onShowBuild}
        onToggleChanges={() => setShowingChanges((v) => !v)}
        onToggleExample={() => setExampleOpen((v) => !v)}
      />
      {content.nothingMoreToAsk && (
        <p className="text-sm text-slate-600">
          Nothing more to ask right now. Change an answer and it&apos;s checked again.
        </p>
      )}
    </div>
  );

  const endNote = draft && (
    <p className="pt-1 leading-relaxed">
      {aimFor(storyType)}{" "}
      {draft.untracedNumbers.length === 0 ? (
        <span data-testid="number-check">Every number above comes from your answers.</span>
      ) : (
        <span className="text-amber-800" data-testid="number-check">
          These figures aren&apos;t in your answers:{" "}
          <strong className="font-semibold">{draft.untracedNumbers.join(", ")}</strong>. If
          they&apos;re real, add them to an answer and rewrite. If not, rewrite to drop them.
        </span>
      )}
    </p>
  );

  // Practising it out loud is the next step once the story is at the top level (or graded Strong,
  // for stories without levels); before that, the level step in the margin is.
  const practiceLeads = levelsOn ? level === TOP_LEVEL : grade?.tier === "strong";
  const why = showWhy && draft ? whyNotes(content, storyType) : undefined;

  return (
    <div className="mt-8 animate-enter" aria-busy={busy !== null}>
      {draft && (
        <div className="flex flex-wrap items-center gap-3" data-testid="story-actions">
          <Link href="/practice" className={practiceLeads ? "btn-next" : "btn-secondary"}>
            Practice it out loud
          </Link>
          <CopyButton text={paragraphs.join("\n\n")} className="btn-secondary" />
          <button
            type="button"
            onClick={() => onRun([{ busy: "writing", action: () => writeDraft(sid()) }])}
            disabled={disabled}
            aria-busy={busy === "writing"}
            className="btn-secondary"
          >
            {busy === "writing" ? "Rewriting…" : "Rewrite"}
          </button>
          {canStrengthen(content) && !content.nothingMoreToAsk && !levelLeads && (
            <button
              type="button"
              onClick={onStrengthen}
              disabled={disabled}
              aria-busy={busy === "probing"}
              className="btn-secondary"
              title="Questions that make it stronger. They open on the Build tab."
            >
              {/* The questions appear on the Build tab; until then this is the only sign on this
                  tab that anything is happening (round 27 personas read it as dead). */}
              {busy === "probing" ? "Finding more questions…" : "Ask me more"}
            </button>
          )}
          <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-ink-100 sm:block" />
          <WhyToggle
            on={showWhy}
            onChange={(on) => {
              setShowWhy(on);
              if (on && !analysisIsCurrent(content.analysis, draft.writtenAt) && !disabled) {
                onRun([{ busy: "analyzing", action: () => analyzeDraft(sid()) }]);
              }
            }}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {exampleOpen && where?.next && (
        <section
          className="mt-10 border-y border-ink-100 py-8"
          aria-label={`An example story at Level ${where.next}`}
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-semibold text-slate-900">
              The same kind of story at each level
            </h2>
            <button
              type="button"
              onClick={() => setExampleOpen(false)}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 hover:underline"
            >
              Hide
            </button>
          </div>
          <div className="mt-4 max-w-3xl">
            <ExampleLadder field={field} startAt={where.next} testId="level-example-ladder" />
          </div>
        </section>
      )}

      <div className={`mt-12 transition-opacity ${busy === "writing" ? "opacity-60" : ""}`}>
        {draft && why ? (
          <TalkTrack
            key="why"
            draft={draft}
            storyType={storyType}
            lead={
              <WhyLead
                content={content}
                storyType={storyType}
                analyzing={busy === "analyzing"}
                disabled={disabled}
                onAnalyze={() => onRun([{ busy: "analyzing", action: () => analyzeDraft(sid()) }])}
              />
            }
            notes={why.notes}
            quotes={why.quotes}
            notesUnder
            endNote={endNote}
          />
        ) : draft ? (
          <div key={draft.writtenAt} className="animate-fade">
            <TalkTrack
              draft={draft}
              storyType={storyType}
              lead={lead}
              notes={Object.fromEntries(order.map((p) => [p, margin(p)]))}
              marked={marked}
              refs={refs}
              changes={changes}
              end={margin(END_OF_STORY)}
              endNote={endNote}
            />
          </div>
        ) : (
          <NotesSoFar content={content} storyType={storyType} onShowBuild={onShowBuild} />
        )}
      </div>

      {draft && (
        <UseThisStory
          rows={[
            {
              id: "practice",
              title: "Practice it out loud",
              what: "Say it, then answer the follow-ups an interviewer would ask.",
              action: "Start",
              href: "/practice",
            },
            ...(canTell(storyType)
              ? [
                  {
                    id: "telling",
                    title: "Coach the telling",
                    what: "An opening line, the turning point, one vivid detail, and 30-second and 2-minute versions.",
                    action: "Open",
                    made: Boolean(content.telling),
                    panel: (
                      <TellingPanel
                        content={content}
                        storyType={storyType}
                        coaching={busy === "coaching"}
                        disabled={disabled}
                        onCoach={() => onRun([{ busy: "coaching", action: () => coachDraft(sid()) }])}
                        onPickHook={(i) => onRun([{ busy: "saving", action: () => pickHook(sid(), i) }])}
                        onAddDetail={(answer) =>
                          onRun([
                            { busy: "saving", action: () => addVividDetail(sid(), answer) },
                            { busy: "coaching", action: () => coachDraft(sid()) },
                          ])
                        }
                      />
                    ),
                  },
                ]
              : []),
            ...(execMode && canExec(storyType)
              ? [
                  {
                    id: "exec",
                    title: "Exec version",
                    what: "About 30 seconds, result first: what it was worth and the decision behind it.",
                    action: "Open",
                    made: Boolean(content.exec),
                    panel: (
                      <ExecPanel
                        storyId={sid}
                        content={content}
                        storyType={storyType}
                        disabled={disabled}
                        onContent={onContent}
                      />
                    ),
                  },
                ]
              : []),
            ...((recruiterScreen || content.recruiter) && canRecruiter(storyType)
              ? [
                  {
                    id: "recruiter",
                    title: "Recruiter version",
                    what: "Under a minute, in plain words, for a recruiter screen.",
                    action: "Open",
                    made: Boolean(content.recruiter),
                    panel: (
                      <RecruiterPanel
                        storyId={sid}
                        content={content}
                        storyType={storyType}
                        disabled={disabled}
                        onContent={onContent}
                      />
                    ),
                  },
                ]
              : []),
            ...(storyType?.format !== "intro"
              ? [
                  {
                    id: "also",
                    title: "Other questions it answers",
                    what: "Where else this story fits, and what to lead with each time.",
                    action: "Find",
                    made: Boolean(content.alsoAnswers),
                    panel: (
                      <AlsoAnswersPanel
                        storyId={sid}
                        content={content}
                        storyType={storyType}
                        disabled={disabled}
                        onContent={onContent}
                      />
                    ),
                  },
                ]
              : []),
          ]}
          extra={uses}
        />
      )}

      {draft && (
        <EvaluationPanel
          className="mt-16"
          content={content}
          storyType={storyType}
          grading={busy === "grading"}
          disabled={disabled}
          onGrade={() => onRun([{ busy: "grading", action: () => gradeDraft(sid()) }])}
        />
      )}
      {after && <div className="mt-16 flex flex-col gap-10 empty:hidden">{after}</div>}
    </div>
  );
}

type UseRow = {
  id: string;
  title: string;
  what: string;
  action: string;
  href?: string;
  // Something was made with it already, for this or an earlier version of the story.
  made?: boolean;
  panel?: React.ReactNode;
};

// What to do with a written story, one row each: what it is, what you get, and the way in. A row
// opens its tool under it; one the user already used shows as "Open".
function UseThisStory({ rows, extra }: { rows: UseRow[]; extra?: React.ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();
  return (
    <section className="mt-16" aria-labelledby={id} data-testid="more-with-story">
      <h2 id={id} className="text-lg font-semibold text-slate-900">
        Use this story
      </h2>
      <ul className="mt-4 border-t border-ink-100">
        {rows.map((r) => {
          const isOpen = open === r.id;
          return (
            <li key={r.id} className="border-b border-ink-100 last:border-b-0" data-testid={`use-${r.id}`}>
              <div className="grid grid-cols-1 gap-x-8 gap-y-1 py-4 sm:grid-cols-[13rem_minmax(0,1fr)_auto] sm:items-baseline">
                <p className="font-medium text-slate-900">{r.title}</p>
                <p className="text-sm text-slate-600">{r.what}</p>
                {r.href ? (
                  <Link href={r.href} className="link justify-self-start text-sm sm:justify-self-end">
                    {r.action}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : r.id)}
                    aria-expanded={isOpen}
                    className="link justify-self-start text-sm sm:justify-self-end"
                  >
                    {isOpen ? "Close" : r.made ? "Open" : r.action}
                  </button>
                )}
              </div>
              {r.panel && (
                <div hidden={!isOpen} className="max-w-3xl animate-enter pb-8">
                  {r.panel}
                </div>
              )}
            </li>
          );
        })}
        {extra}
      </ul>
    </section>
  );
}

// Switches the story between the script and "Why it works".
function WhyToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm font-medium text-slate-700 hover:text-slate-900"
      data-testid="why-toggle"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${
          on ? "bg-ink-900" : "bg-ink-200"
        }`}
      >
        <span
          className={`absolute top-0.5 size-3 rounded-full bg-white transition-[left] ${
            on ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
      Why it works
    </button>
  );
}

// Before the story is written: what each part has to go on so far.
function NotesSoFar({
  content,
  storyType,
  onShowBuild,
}: {
  content: StoryContent;
  storyType: StoryType | undefined;
  onShowBuild: () => void;
}) {
  const parts = storyParts(storyType);
  return (
    <div className="max-w-3xl" data-testid="notes-so-far">
      <p className="text-[0.9375rem] text-slate-700">
        Not written yet. What each part has to go on so far:
      </p>
      <ol className="mt-6 flex flex-col gap-6">
        {parts.map((part) => {
          const notes = notesForPart(content, storyType, parts, part);
          return (
            <li
              key={part.id}
              className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-6"
              data-testid={`part-${part.id}`}
            >
              <p className="pt-0.5 text-sm text-slate-500">{trackLabel(part)}</p>
              {notes.length ? (
                <ul className="flex flex-col gap-2">
                  {notes.map((note, i) => (
                    <li
                      key={i}
                      className="line-clamp-3 whitespace-pre-wrap font-words text-base leading-relaxed text-slate-800"
                    >
                      {note}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pt-0.5 text-sm text-slate-500">
                  {part.id === "principle"
                    ? "Optional: how you think about problems like this, said before the story."
                    : "Nothing yet."}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={onShowBuild} className="btn-next mt-8">
        Answer the questions
      </button>
    </div>
  );
}

function notesForPart(
  content: StoryContent,
  storyType: StoryType | undefined,
  parts: readonly StoryPart[],
  part: StoryPart,
): string[] {
  const partFor = (gap: string) => partForGap(gap, parts);
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

// A note's number, in the coach's pen, matching the one set after the paragraph's last word.
function Num({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-700 font-mono text-[0.6875rem] font-semibold tabular-nums text-white"
    >
      {n}
    </span>
  );
}

// What the next level needs from this part of the story.
function GapNote({ num, gap }: { num: number; gap: LevelGap }) {
  return (
    <div data-testid="level-gap">
      <p className="flex items-start gap-2 text-sm font-semibold text-slate-900">
        <Num n={num} />
        <span className="pt-px">
          <span className="sr-only">{num}. </span>
          {gap.label}
        </span>
      </p>
      <p className="mt-1.5 pl-7 text-sm leading-relaxed text-slate-700">{gap.detail}</p>
    </div>
  );
}

// What already works in this part (a criterion scored Strong), so the user knows what to keep.
function StrongNote({ label, note }: { label: string; note: string }) {
  return (
    <p className="text-sm leading-relaxed text-slate-700" data-testid="strong-note">
      <span className="font-medium text-emerald-700">✓ {label}.</span> {note}
    </p>
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
    <div data-testid="weak-part">
      <p className="text-sm font-semibold text-amber-800">Weakest part: {part.label}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {SCORE_LABELS[part.score] ?? part.score}, {part.score} of 4
      </p>
      {(part.improve || part.note) && (
        <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{part.improve || part.note}</p>
      )}
      <button
        type="button"
        onClick={onAsk}
        disabled={disabled}
        aria-busy={busy}
        className="btn-next mt-3"
      >
        {busy ? "Thinking of a question…" : "Answer one question to fix it"}
      </button>
      <p className="mt-2 text-xs text-slate-500">Only this part is rewritten from your answer.</p>
    </div>
  );
}

// Story levels on the story itself (design comparison 2026-11-17, pattern 1, after Grammarly), now
// a numbered note in the margin beside the paragraph each question would improve. One is open at a
// time; the rest are a line to tap. Answering the last one rewrites the story and grades it.
function InlineAsk({
  num,
  q,
  target,
  disabled,
  draftScope,
  focus,
  onAnswer,
  onSkip,
}: {
  num: number;
  q: InlineQuestion;
  target: number;
  disabled: boolean;
  draftScope: string;
  // Focus the box: the user picked this question.
  focus: boolean;
  onAnswer: (index: number, answer: string) => void;
  onSkip: (index: number) => void;
}) {
  return (
    <div id="inline-question" className="scroll-mt-24" data-testid="inline-question">
      <p className="flex items-start gap-2 text-sm font-semibold text-slate-900">
        <Num n={num} />
        <span className="pt-px">
          <span className="sr-only">{num}. </span>
          {q.label}
          <span className="font-normal text-slate-500"> · for Level {target}</span>
        </span>
      </p>
      <p className="mt-2 font-words text-[1.0625rem] leading-snug text-slate-900">{q.question}</p>
      <div className="mt-3">
        <Composer
          key={q.index}
          size="sm"
          initial=""
          rows={3}
          autoFocus={focus}
          disabled={disabled}
          submitLabel="Add to story"
          onSubmit={(answer) => onAnswer(q.index, answer)}
          onSkip={() => onSkip(q.index)}
          skipLabel="I don't know"
          draftKey={`${draftScope}:fu-${q.index}`}
        />
      </div>
    </div>
  );
}

function AskButton({
  num,
  q,
  disabled,
  onChoose,
}: {
  num: number;
  q: InlineQuestion;
  disabled: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      disabled={disabled}
      className="group flex items-start gap-2 text-left text-sm disabled:opacity-50"
      data-testid="inline-ask-chip"
    >
      <Num n={num} />
      <span className="pt-px">
        <span className="sr-only">{num}. </span>
        <span className="font-medium text-slate-900 group-hover:underline">{q.label}</span>
        <span className="text-slate-500"> · one question</span>
      </span>
    </button>
  );
}
