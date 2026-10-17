import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/app-header";
import { AskedRecently, QuestionList } from "@/components/question-list";
import { forJob } from "@/lib/bank/content";
import { recentSharedQuestions } from "@/lib/bank/data";
import { StepStrip } from "@/components/step-strip";
import { jobSteps } from "@/lib/guide/journey";
import { getJob, getJobsPrep } from "@/lib/jobs/data";
import { jobFolder } from "@/lib/jobs/folder";
import { currentItemIndex } from "@/lib/practice/content";
import { listPracticeSessionsSafely } from "@/lib/practice/data";
import { MAX_STORIES, changedStories, isFinishedStory } from "@/lib/resume/content";
import { builderStage, hasDraft } from "@/lib/stories/content";
import { listStories } from "@/lib/stories/data";
import { REQUIRED_STORY_TYPE_ID, getStoryType } from "@/lib/stories/story-types";
import { listTranscriptsForPrep } from "@/lib/transcripts/data";
import { removeJob } from "../actions";
import { InterviewDateForm, LevelForm, PendingButton, PredictForm } from "../forms";
import { AskPanel } from "./ask-panel";
import { ResumePanel } from "./resume-panel";
import { TailoredIntroPanel } from "./tailored-intro";

export const metadata: Metadata = { title: "Target job · InterviewMax" };

// Predicting questions, suggesting questions to ask, writing About me or resume bullets for this job and removing a job (which reads the remaining jobs again) are model calls.
export const maxDuration = 120;

export default function JobPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/jobs" className="text-sm font-medium text-ink-800 hover:underline">
          ← All target jobs
        </Link>
        <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-white/80" />}>
          <JobContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function JobContent({ params }: { params: PageProps<"/jobs/[id]">["params"] }) {
  const { id } = await params;
  const [job, { overview, resume }, stories, rounds, transcripts] = await Promise.all([
    getJob(id),
    getJobsPrep(),
    listStories(),
    listPracticeSessionsSafely(id),
    listTranscriptsForPrep(),
  ]);
  if (!job) notFound();
  // Shared question bank: what other people were asked at this company lately.
  const askedRecently = forJob(await recentSharedQuestions(job.company), job.title);
  // This job's folder: the stories that answer its questions and its past interviews.
  const folder = jobFolder(job.likelyQuestions?.questions, stories);
  const interviews = transcripts.filter((t) => t.targetJobId === job.id);
  const read = overview?.jobs[job.id];
  // "Tell me about yourself": the drafted one if there is one (stories are newest first).
  const introType = getStoryType(REQUIRED_STORY_TYPE_ID);
  const intros = stories.filter((s) => s.storyType === REQUIRED_STORY_TYPE_ID);
  const intro = intros.find((s) => hasDraft(s.content)) ?? intros[0];
  const introReady = Boolean(intro && builderStage(intro.content, introType) !== "core");
  const steps = jobSteps({
    job,
    company: job.company || "this job",
    intro: intro && { content: intro.content, ready: introReady },
    stories,
    practiced: rounds.some((r) => r.finishedAt),
  });
  const lastRound = rounds[0];
  // The stories the resume bullets read: the newest finished ones, as when they're written.
  const finished = stories
    .filter(isFinishedStory)
    .slice(0, MAX_STORIES)
    .map((s) => ({ id: s.id, draftWrittenAt: s.content.draft!.writtenAt }));

  return (
    <>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        {job.title}
        {job.company && <span className="font-bold text-slate-500"> at {job.company}</span>}
      </h1>
      {read?.summary && <p className="mt-2 max-w-2xl text-slate-600">{read.summary}</p>}
      <StepStrip label={`Your prep for ${job.title}`} steps={steps} />
      <nav
        aria-label="In this job's folder"
        className="mt-4 flex flex-wrap gap-2 text-sm"
        data-testid="job-folder"
      >
        <FolderTab
          href="#questions"
          label="Likely questions"
          note={folder.total ? `${folder.answered} of ${folder.total} have a story` : "Not yet"}
        />
        <FolderTab href="#stories" label="Stories" note={String(folder.stories.length)} />
        <FolderTab href="#past-interviews" label="Past interviews" note={String(interviews.length)} />
        <FolderTab
          href="#about-me"
          label="About me"
          note={intro?.content.tailored?.[job.id]?.draft ? "Written" : "To do"}
        />
        {job.likelyQuestions && (
          <FolderTab
            href="#practice"
            label="Practice"
            note={`${rounds.length} ${rounds.length === 1 ? "round" : "rounds"}`}
          />
        )}
        <FolderTab href="#resume" label="Resume" note={job.resumeBullets ? "Written" : "To do"} />
        <FolderTab
          href="#ask"
          label="Questions to ask"
          note={job.questionsToAsk?.questions.length ? "Ready" : "To do"}
        />
        <FolderTab href={`/jobs/${job.id}/brief`} label="Brief" note="One page" />
      </nav>
      <div
        className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white px-5 py-3 shadow-sm ring-1 ring-black/5"
        data-testid="job-brief"
      >
        <p className="min-w-0 flex-1 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">Interview day?</span> Your one-page brief
          has your questions, stories, numbers and gaps.
        </p>
        <Link
          href={`/jobs/${job.id}/brief`}
          className="rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-900"
        >
          Open the brief
        </Link>
        <Link
          href={`/jobs/${job.id}/warm-up`}
          className="text-sm font-semibold text-ink-800 hover:underline"
        >
          One-minute warm-up →
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section
            id="questions"
            className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
          >
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">
              Likely questions
            </h2>
            {job.likelyQuestions ? (
              <>
                <p className="mb-4 text-sm text-slate-600">
                  Most likely first. Each one points to the story that answers it, or the one to
                  build.
                </p>
                <QuestionList questions={job.likelyQuestions.questions} stories={stories} />
              </>
            ) : (
              <p className="mb-4 text-slate-600">
                I&apos;ll predict the behavioral questions this job is most likely to ask, from the
                posting and any interview reports you paste, and match each to your stories.
              </p>
            )}
            {askedRecently.length > 0 && (
              <AskedRecently questions={askedRecently} company={job.company ?? ""} stories={stories} />
            )}
            <div className="mt-4">
              <PredictForm
                jobId={job.id}
                reports={job.interviewReports}
                predicted={Boolean(job.likelyQuestions)}
              />
            </div>
          </section>
          <section
            id="stories"
            className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
            data-testid="job-stories"
          >
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">
              Your stories for this job
            </h2>
            {folder.stories.length > 0 ? (
              <>
                <p className="mb-4 text-sm text-slate-600">
                  The stories that answer this job&apos;s likely questions.
                  {folder.toBuild > 0 &&
                    ` ${folder.toBuild} ${folder.toBuild === 1 ? "question still needs" : "questions still need"} a story: see Likely questions.`}
                </p>
                <ul className="space-y-3">
                  {folder.stories.map((s) => (
                    <li key={s.storyId} className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5">
                      <Link
                        href={`/stories/${s.storyId}`}
                        className="font-semibold text-ink-800 hover:underline"
                      >
                        {s.title}
                      </Link>
                      {!s.drafted && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          In progress
                        </span>
                      )}
                      <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
                        {s.questions.map((q) => (
                          <li key={q}>Answers: {q}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-slate-600">
                {job.likelyQuestions
                  ? "None of your stories answers this job's likely questions yet. Each question above links to the story to build."
                  : "Once I've predicted this job's questions, the stories that answer them show up here."}
              </p>
            )}
          </section>
          <section
            id="past-interviews"
            className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
            data-testid="job-interviews"
          >
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">
              Past interviews for this job
            </h2>
            {interviews.length > 0 ? (
              <ul className="mb-4 space-y-2">
                {interviews.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/transcripts/${t.id}`}
                      className="font-semibold text-ink-800 hover:underline"
                    >
                      {t.title}
                    </Link>
                    <span className="ml-2 text-sm text-slate-500">
                      {t.analysis
                        ? `${t.analysis.asked.length} questions asked`
                        : "Not reviewed yet"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-slate-600">
                Had a round for this job already? Add its transcript: questions they asked you
                before go to the top of your likely questions.
              </p>
            )}
            <Link
              href={`/transcripts?job=${job.id}`}
              className="text-sm font-semibold text-ink-800 hover:underline"
            >
              Add an interview for this job →
            </Link>
          </section>
          {job.likelyQuestions && (
            <section
              id="practice"
              className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
              data-testid="job-practice"
            >
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">
                Practice out loud
              </h2>
              <p className="mb-4 text-sm text-slate-600">
                Answer five of these questions out loud, weakest first. The interviewer follows up
                on what&apos;s thin, and you get feedback on each answer and how long it took.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={
                    lastRound && currentItemIndex(lastRound.items) >= 0
                      ? `/practice/${lastRound.id}`
                      : `/jobs/${job.id}/practice`
                  }
                  className="rounded-xl bg-ink-800 px-4 py-2.5 font-semibold text-white transition hover:bg-ink-900"
                >
                  {lastRound && currentItemIndex(lastRound.items) >= 0
                    ? "Carry on practicing"
                    : lastRound
                      ? "Practice again"
                      : "Start practicing"}
                </Link>
                {lastRound && (
                  <Link
                    href={`/jobs/${job.id}/practice`}
                    className="text-sm font-medium text-ink-800 hover:underline"
                  >
                    Your rounds ({rounds.length}) →
                  </Link>
                )}
              </div>
            </section>
          )}
          <section
            id="about-me"
            className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
          >
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">
              Tell me about yourself, for {job.company || "this job"}
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              Start from the company. Your reason for wanting this job decides which one result to
              lead with. Three beats (who you are, one proof point, why here) in under 90 seconds.
            </p>
            {introReady && intro ? (
              <TailoredIntroPanel
                jobId={job.id}
                company={job.company || "this company"}
                initial={intro.content.tailored?.[job.id]}
              />
            ) : (
              <p className="text-slate-600">
                First, answer a few questions about your career in{" "}
                <Link
                  href={intro ? `/stories/${intro.id}` : "/stories/new"}
                  className="font-semibold text-ink-800 underline"
                >
                  Tell me about yourself
                </Link>
                . Then come back here to shape it for this job.
              </p>
            )}
          </section>
          <section
            id="resume"
            className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
          >
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">
              Resume bullets for this job
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              Your stories, turned into bullets for the resume you already have: what you did and
              what came of it, best fit for this job first. Every number comes from your own
              answers, so your resume and your interview tell the same story.
            </p>
            <ResumePanel
              jobId={job.id}
              initial={job.resumeBullets}
              finishedCount={finished.length}
              changedCount={job.resumeBullets ? changedStories(job.resumeBullets, finished) : 0}
            />
          </section>
          <section
            id="ask"
            className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
          >
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">
              Questions to ask them
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              Every interview ends with &ldquo;Any questions for us?&rdquo;. Questions drawn from
              this posting show you&apos;ve done the work. Save the ones you like and they go in
              your brief.
            </p>
            <AskPanel jobId={job.id} initial={job.questionsToAsk} />
          </section>
          {read && read.focus.length > 0 && (
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-800">
                What their interviewers will look for
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-slate-700" data-testid="job-focus">
                {read.focus.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {read.differs && <p className="mt-4 text-sm text-slate-500">{read.differs}</p>}
            </section>
          )}
          {!read && (
            <section className="rounded-3xl bg-amber-50 p-6 ring-1 ring-black/5">
              <p className="text-slate-700">
                I haven&apos;t read this job yet.{" "}
                <Link href="/jobs" className="font-semibold text-ink-800 underline">
                  Read your jobs
                </Link>{" "}
                from the jobs page.
              </p>
            </section>
          )}
          <details className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-ink-800">
              The posting
            </summary>
            <p className="mt-4 whitespace-pre-line text-slate-700">{job.description}</p>
          </details>
        </div>

        <div className="space-y-4">
          <section
            id="interview-date"
            className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
          >
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">
              Interview date
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              Your plan on the home page fits the time you have: tomorrow, the top 3 questions and
              About me; two weeks, your whole story bank.
            </p>
            <InterviewDateForm jobId={job.id} date={job.interviewDate} />
          </section>
          <section
            id="level"
            className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
          >
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">
              Role level
            </h2>
            <p className="mb-4 text-sm text-slate-600">
              The level sets how senior your stories need to sound and which tier to aim for.
            </p>
            <LevelForm jobId={job.id} level={job.level} confirmed={job.levelConfirmed} />
          </section>
          {!resume && job.likelyQuestions && (
            <section
              className="rounded-3xl bg-ink-50 p-6 ring-1 ring-ink-800/10"
              data-testid="offer-resume"
            >
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">
                Optional: add your resume
              </h2>
              <p className="text-sm text-slate-700">
                I&apos;ll check it against this job: what your history already shows, and what your
                stories need to cover.
              </p>
              <Link
                href="/jobs"
                className="mt-3 inline-block text-sm font-semibold text-ink-800 hover:underline"
              >
                Add your resume →
              </Link>
            </section>
          )}
          <form action={removeJob}>
            <input type="hidden" name="jobId" value={job.id} />
            <PendingButton
              pendingText="Removing…"
              className="text-sm font-medium text-slate-500 hover:text-red-700"
            >
              Remove this job
            </PendingButton>
          </form>
        </div>
      </div>
    </>
  );
}

// One entry in the strip that shows what's in this job's folder, with where it stands.
function FolderTab({ href, label, note }: { href: string; label: string; note: string }) {
  return (
    <Link
      href={href}
      className="flex items-baseline gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-black/5 transition hover:ring-ink-800/30"
    >
      <span className="font-semibold text-slate-900">{label}</span>
      <span className="text-slate-500">{note}</span>
    </Link>
  );
}
