import "server-only";
import { generateForStep } from "@/lib/ai";
import { getJob, getJobsPrep, saveResumeBullets } from "@/lib/jobs/data";
import { getNumbersChecklistSafely } from "@/lib/numbers/data";
import { numbersForStory } from "@/lib/numbers/checklist";
import { allAnswerText } from "@/lib/stories/content";
import { listStories } from "@/lib/stories/data";
import { draftText } from "@/lib/stories/grading";
import { answersTranscript } from "@/lib/stories/prompts";
import { REQUIRED_STORY_TYPE_ID, getStoryType } from "@/lib/stories/story-types";
import { tailoredText } from "@/lib/stories/tailored";
import { bulletsFromReply, checkedSummary, replyProblems } from "./checks";
import { MAX_STORIES, isFinishedStory, type FinishedStory, type ResumeSet } from "./content";
import { RESUME_SYSTEM, parseResumeReply, resumeMessages, type ResumeRetry } from "./prompts";

// Writes the resume bullet set for one target job from the user's finished stories and saves it on
// the job. One call, one retry with the problems named; whatever is still off is left out (a
// bullet with an untraced figure, a summary with one), never shown.
export async function buildResumeSet(jobId: string): Promise<ResumeSet> {
  const [job, { overview, resume }, stories, checklist] = await Promise.all([
    getJob(jobId),
    getJobsPrep(),
    listStories(),
    getNumbersChecklistSafely(),
  ]);
  if (!job) throw new Error("Job not found.");

  // Newest first, as listStories returns them.
  const finished: FinishedStory[] = stories
    .filter(isFinishedStory)
    .slice(0, MAX_STORIES)
    .map((s) => {
      const type = getStoryType(s.storyType);
      const values = numbersForStory(checklist, s.storyType).flatMap((n) =>
        n.value ? [n.value] : [],
      );
      return {
        id: s.id,
        title: s.title,
        typeLabel: type?.label ?? "Story",
        story: draftText(s.content.draft!.parts, type),
        answers: answersTranscript(s.content, type),
        source: [allAnswerText(s.content), ...values].join("\n"),
        draftWrittenAt: s.content.draft!.writtenAt,
      };
    });
  if (finished.length === 0) {
    throw new Error("Finish writing a story first: bullets come from your written stories.");
  }

  // The summary comes from About me for this job, or the general About me when there isn't one.
  const introType = getStoryType(REQUIRED_STORY_TYPE_ID);
  const intros = stories.filter((s) => s.storyType === REQUIRED_STORY_TYPE_ID);
  const intro =
    intros.find((s) => s.content.tailored?.[job.id]?.draft) ?? intros.find((s) => s.content.draft);
  const tailored = intro?.content.tailored?.[job.id];
  const aboutMe = tailored?.draft
    ? tailoredText(tailored.draft.parts)
    : intro?.content.draft
      ? draftText(intro.content.draft.parts, introType)
      : "";
  const allNumbers = numbersForStory(checklist, null).flatMap((n) =>
    n.value ? [{ line: `${n.label}: ${n.value}`, value: n.value }] : [],
  );
  const summarySource = [
    intro ? allAnswerText(intro.content) : "",
    tailored?.whyCompany ?? "",
    ...allNumbers.map((n) => n.value),
  ].join("\n");

  const base = {
    job: {
      title: job.title,
      company: job.company,
      level: job.level,
      description: job.description,
      focus: overview?.jobs[job.id]?.focus ?? [],
      questions: job.likelyQuestions?.questions.map((q) => q.question) ?? [],
    },
    stories: finished,
    aboutMe,
    numbers: allNumbers.map((n) => n.line),
    resume: resume?.text ?? "",
  };

  let best:
    | { reply: ReturnType<typeof parseResumeReply>; model: string; problems: string[] }
    | undefined;
  let retry: ResumeRetry | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generateForStep("resumeBullets", {
      system: RESUME_SYSTEM,
      messages: resumeMessages({ ...base, retry }),
    });
    if (result.stopReason === "refusal") throw new Error("The model declined to write bullets.");
    const reply = parseResumeReply(result.text, finished.length);
    const problems = replyProblems(reply, finished, summarySource);
    if (!best || problems.length < best.problems.length)
      best = { reply, model: result.model, problems };
    if (problems.length === 0) break;
    retry = { previous: result.text, problems };
  }

  const { reply, model } = best!;
  const { bullets, leftOut } = bulletsFromReply(reply, finished, base.resume);
  if (bullets.length === 0) {
    throw new Error("None of the bullets passed the number check. Try again.");
  }
  const summary = aboutMe ? checkedSummary(reply.summary, summarySource) : "";
  const value: ResumeSet = {
    summary,
    summarySource: summary ? (tailored?.draft ? "tailored" : "general") : "",
    bullets,
    stories: Object.fromEntries(finished.map((s) => [s.id, s.draftWrittenAt])),
    leftOut,
    model,
    generatedAt: new Date().toISOString(),
  };
  await saveResumeBullets(job.id, value);
  return value;
}
