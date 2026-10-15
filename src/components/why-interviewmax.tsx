// The problem InterviewMax solves and why it exists, from the PRD.
// Shown on the home page and on the sign-in page, so signed-out visitors see it too.

const REASONS = [
  {
    title: "No numbers at hand",
    body: "You don't know which figures interviewers want, or where to find them.",
  },
  {
    title: "No structure",
    body: "Stories ramble because they were never built against a framework or refined.",
  },
  {
    title: "Unclear emphasis",
    body: "It's hard to tell which parts of your history matter most for this role.",
  },
  {
    title: "Prep that doesn't pay off",
    body: "Prepare 50 answers, get asked 2, and never learn whether any of it worked.",
  },
];

const PROBLEM =
  "Behavioral interviews are the first gate in almost every hiring loop. Most people know roughly which questions are coming, and still walk in with rambling stories that have no numbers.";

const TEASER = "Most people walk into behavioral interviews with rambling stories and no numbers.";

// compact: a one-line strip that opens to the full reasons, so the home page gets to the stories fast.
export function WhyInterviewMax({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <details
        className={`group rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 ${className}`}
        data-testid="why-interviewmax"
      >
        <summary className="flex cursor-pointer list-none items-baseline gap-3 [&::-webkit-details-marker]:hidden">
          <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-ink-700">
            Why InterviewMax
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-slate-600 group-open:hidden">
            {TEASER}
          </span>
          <span className="ml-auto shrink-0 text-sm font-semibold text-ink-800">
            <span className="group-open:hidden">More</span>
            <span className="hidden group-open:inline">Less</span>
          </span>
        </summary>
        <div className="pb-1 pt-3">
          <WhyBody />
        </div>
      </details>
    );
  }
  return (
    <section
      aria-labelledby="why-interviewmax"
      className={`rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8 ${className}`}
    >
      <h2
        id="why-interviewmax"
        className="text-sm font-bold uppercase tracking-wide text-ink-700"
      >
        Why InterviewMax
      </h2>
      <div className="mt-3">
        <WhyBody />
      </div>
    </section>
  );
}

function WhyBody() {
  return (
    <>
      <p className="max-w-3xl text-lg text-slate-800">{PROBLEM}</p>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {REASONS.map((reason) => (
          <li key={reason.title} className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">{reason.title}</p>
            <p className="mt-1 text-sm text-slate-600">{reason.body}</p>
          </li>
        ))}
      </ul>

      <p className="mt-6 max-w-3xl text-slate-700">
        Knowing the questions isn&apos;t the hard part. Prep is long, untargeted, and gives no
        signal on whether it worked. InterviewMax is a guided path instead of a set of tools: one
        story at a time, drawn from your own answers and your own numbers, aimed at the jobs
        you&apos;re going for, so you can see where you stand and what to do next.
      </p>
    </>
  );
}
