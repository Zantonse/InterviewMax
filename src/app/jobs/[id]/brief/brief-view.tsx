import Link from "next/link";
import { startStory } from "@/app/stories/new/actions";
import { STARTER_QUESTIONS, type Brief, type BriefQuestion } from "@/lib/brief/brief";
import { whenLabel } from "@/lib/prep/plan";
import { getStoryType } from "@/lib/stories/story-types";
import { PrintButton } from "./print-button";

// The brief itself, from data already assembled (see src/lib/brief). `days` is how far off the
// interview is, when the job has a date.
export function BriefView({ brief, days }: { brief: Brief; days: number | null }) {
  const { job } = brief;
  const company = job.company || "this company";
  return (
    <>
      <Link
        href={`/jobs/${job.id}`}
        className="text-sm print:text-xs font-medium text-ink-800 hover:underline print:hidden"
      >
        ← {job.title}
        {job.company ? ` at ${job.company}` : ""}
      </Link>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-700 print:mt-0">
        Pre-interview brief{days !== null ? ` · interview ${whenLabel(days)}` : ""}
      </p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl print:text-xl">
        {job.title}
        {job.company && <span className="font-bold text-slate-500"> at {job.company}</span>}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
        {brief.questions.length > 0 || brief.intro ? (
          <Link
            href={`/jobs/${job.id}/warm-up`}
            className="rounded-xl bg-accent-400 px-4 py-2.5 font-semibold text-ink-950 transition hover:bg-accent-300"
            data-testid="start-warm-up"
          >
            Start the one-minute warm-up
          </Link>
        ) : null}
        <PrintButton />
      </div>
      <p className="mt-2 text-sm print:text-xs text-slate-500 print:hidden">
        For the hour before: About me, three numbers and your top questions, one at a time.
      </p>

      <div className="mt-6 space-y-4 print:mt-3 print:space-y-3" data-testid="brief">
        <Section title={`Why ${company}`} testId="brief-why">
          {brief.intro ? (
            <>
              {brief.intro.whyCompany && (
                <p className="mb-3 border-l-4 border-accent-400 pl-3 text-slate-700 italic">
                  {brief.intro.whyCompany}
                </p>
              )}
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tell me about yourself
                {brief.intro.kind === "tailored" ? `, for ${company}` : ""}
              </p>
              <div className="space-y-2 text-slate-800">
                {brief.intro.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              {brief.intro.kind === "general" && (
                <p className="mt-3 text-sm print:text-xs text-slate-500 print:hidden">
                  This is your general version.{" "}
                  <Link
                    href={`/jobs/${job.id}#about-me`}
                    className="font-semibold text-ink-800 underline"
                  >
                    Shape it for {company}
                  </Link>{" "}
                  so it opens with why you want this job.
                </p>
              )}
            </>
          ) : (
            <p className="text-slate-600">
              No About me yet.{" "}
              <Link
                href={`/jobs/${job.id}#about-me`}
                className="font-semibold text-ink-800 underline"
              >
                Write it for {company}
              </Link>
              : most interviews open with it.
            </p>
          )}
        </Section>

        <Section title="Likely questions and your stories" testId="brief-questions">
          {brief.questions.length > 0 ? (
            <>
              <ol className="space-y-3">
                {brief.questions.map((q, i) => (
                  <QuestionRow key={q.question} q={q} n={i + 1} />
                ))}
              </ol>
              {brief.moreQuestions > 0 && (
                <p className="mt-3 text-sm print:text-xs text-slate-500 print:hidden">
                  {brief.moreQuestions} more on{" "}
                  <Link href={`/jobs/${job.id}#questions`} className="text-ink-800 underline">
                    the job page
                  </Link>
                  .
                </p>
              )}
            </>
          ) : (
            <p className="text-slate-600">
              No likely questions yet.{" "}
              <Link
                href={`/jobs/${job.id}#questions`}
                className="font-semibold text-ink-800 underline"
              >
                Predict them for this job
              </Link>{" "}
              and they&apos;ll show here with the story to answer each.
            </p>
          )}
        </Section>

        <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-3">
          <Section title="Key numbers" testId="brief-numbers">
            {brief.numbers.length > 0 ? (
              <dl className="space-y-1.5">
                {brief.numbers.map((n) => (
                  <div key={n.id}>
                    <dt className="text-sm print:text-xs text-slate-500">{n.label}</dt>
                    <dd className="font-semibold text-slate-900">{n.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-slate-600">
                None filled in yet.{" "}
                <Link href="/numbers" className="font-semibold text-ink-800 underline">
                  Add your numbers
                </Link>
                .
              </p>
            )}
          </Section>

          <Section title="Gaps" testId="brief-gaps">
            {brief.questions.length === 0 ? (
              <p className="text-slate-600">Shown once your likely questions are in.</p>
            ) : brief.gaps.length === 0 ? (
              <p className="text-slate-700">
                None. Every likely question here has a written story.
              </p>
            ) : (
              <>
                <p className="mb-2 text-sm print:text-xs text-slate-600">
                  No written story yet. Have an example in mind before you walk in.
                </p>
                <ul className="list-disc space-y-1 pl-5 text-slate-800">
                  {brief.gaps.map((q) => (
                    <li key={q.question}>{q.question}</li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        </div>

        <div
          className={`grid gap-4 print:gap-3 ${brief.tough.length > 0 ? "print:grid-cols-2" : ""}`}
        >
          {brief.tough.length > 0 && (
            <Section title="Tough questions" testId="brief-tough">
              <ul className="space-y-3">
                {brief.tough.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={t.href}
                      className="font-semibold text-slate-900 hover:underline print:no-underline"
                    >
                      {t.question}
                    </Link>
                    <p className="mt-0.5 text-slate-700">{t.answer}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Questions to ask them" testId="brief-ask">
            {brief.ask.groups.length > 0 ? (
              <div className="space-y-3 print:space-y-2">
                {brief.ask.groups.map((g) => (
                  <div key={g.audience}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {g.label}
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-800">
                      {g.questions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="text-sm print:text-xs text-slate-500 print:hidden">
                  <Link href={`/jobs/${job.id}#ask`} className="text-ink-800 underline">
                    Edit your questions
                  </Link>
                </p>
              </div>
            ) : (
              <>
                <ul className="list-disc space-y-1 pl-5 text-slate-800">
                  {STARTER_QUESTIONS.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm print:text-xs text-slate-500 print:hidden">
                  Good for any interview.{" "}
                  <Link
                    href={`/jobs/${job.id}#ask`}
                    className="font-semibold text-ink-800 underline"
                  >
                    {brief.ask.unsaved > 0
                      ? `Save some of the ${brief.ask.unsaved} written for ${company}`
                      : `Get questions written for ${company}`}
                  </Link>{" "}
                  and they&apos;ll show here instead.
                </p>
              </>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="break-inside-avoid rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 print:rounded-none print:p-0 print:shadow-none print:ring-0"
      data-testid={testId}
    >
      <h2 className="mb-3 text-sm print:text-xs font-bold uppercase tracking-wide text-ink-800 print:mb-1">
        {title}
      </h2>
      {children}
    </section>
  );
}

function QuestionRow({ q, n }: { q: BriefQuestion; n: number }) {
  return (
    <li className="break-inside-avoid">
      <p className="font-semibold text-slate-900">
        <span className="mr-2 text-ink-800">{n}.</span>
        {q.question}
      </p>
      <div className="mt-0.5 pl-6 text-sm print:text-xs">
        {q.story ? (
          <>
            <Link
              href={q.story.href}
              className="font-medium text-ink-800 hover:underline print:no-underline"
            >
              {q.story.drafted ? "Answer with" : "Story in progress"}: {q.story.title}
            </Link>
            {q.story.reminder && <p className="text-slate-600">{q.story.reminder}</p>}
          </>
        ) : q.buildType ? (
          <form action={startStory} className="flex flex-wrap items-center gap-2">
            <span className="text-amber-800">No story yet.</span>
            <button
              type="submit"
              name="storyType"
              value={q.buildType}
              className="font-medium text-ink-800 hover:underline print:hidden"
            >
              Build &ldquo;{getStoryType(q.buildType)?.label}&rdquo; →
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}
