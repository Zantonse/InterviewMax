import { clock, countWords, spokenSeconds } from "@/lib/stories/spoken";

// The promise in one picture (design review 2026-11-23, fix 8): how most people answer the question
// on the left, then the same story on the talk track the app draws, with the time each part starts
// at, the figures underlined in the coach's pen and what the coach's questions added beside it.

// A figure in the story, underlined like the numbers in a user's own story.
type Piece = string | { figure: string };

const RAMBLE =
  "So, my manager and I didn’t really agree on the onboarding project, and it was kind of a mess, and I pushed back a bit, and in the end it went pretty well, customers liked it…";

const PARTS: { id: string; label: string; added: string; text: Piece[] }[] = [
  {
    id: "principle",
    label: "Principle",
    added: "how you think",
    text: ["When a team is slow, I look at the handoffs before I ask for more people."],
  },
  {
    id: "situation",
    label: "Context",
    added: "the stakes",
    text: [
      "Our ",
      { figure: "40" },
      " enterprise accounts took ",
      { figure: "9 weeks" },
      " to go live, two were about to churn, and my manager wanted four more onboarding hires.",
    ],
  },
  {
    id: "actions",
    label: "Action",
    added: "what you did",
    text: [
      "I asked for two weeks to try another way. I mapped every handoff, showed that ",
      { figure: "6" },
      " of our ",
      { figure: "14" },
      " setup steps did the real work, and we cut the other ",
      { figure: "8" },
      ".",
    ],
  },
  {
    id: "result",
    label: "Result",
    added: "the number",
    text: [
      "Go-live dropped to ",
      { figure: "3 weeks" },
      " with no new hires, and both accounts renewed.",
    ],
  },
  {
    id: "reflection",
    label: "Learning",
    added: "the lesson",
    text: [
      "We settled it with a map instead of opinions. Now I bring the evidence to the first conversation.",
    ],
  },
];

const plain = (pieces: Piece[]) =>
  pieces.map((p) => (typeof p === "string" ? p : p.figure)).join("");

// Each part's start, counted the way the story page counts it.
function track() {
  let words = 0;
  const rows = PARTS.map((part) => {
    const start = spokenSeconds(words);
    words += countWords(plain(part.text));
    return { ...part, start };
  });
  return { rows, seconds: spokenSeconds(words) };
}

export function BeforeAfter() {
  const { rows, seconds } = track();
  return (
    <div data-testid="before-after">
      <figure>
        <figcaption className="flex items-baseline justify-between gap-4 text-sm text-slate-600">
          <span>How most people answer</span>
          <span className="font-mono text-xs tabular-nums">0:48 and counting</span>
        </figcaption>
        <blockquote className="mt-3 font-words text-xl leading-relaxed text-slate-600 italic">
          &ldquo;{RAMBLE}&rdquo;
        </blockquote>
      </figure>

      <figure className="mt-10">
        <figcaption className="flex items-baseline justify-between gap-4 text-sm text-slate-600">
          <span>The same story, built in InterviewMax</span>
          <span className="font-mono text-xs tabular-nums">{clock(seconds)}</span>
        </figcaption>
        <ol className="mt-5">
          {rows.map((row, i) => (
            <li
              key={row.id}
              className="grid grid-cols-[3.75rem_0.75rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[3.75rem_0.75rem_minmax(0,1fr)_6.5rem] sm:gap-x-4"
            >
              <p className="pt-1 text-right leading-tight">
                <span className="block font-mono text-sm tabular-nums text-ink-700">
                  {clock(row.start)}
                </span>
                <span className="mt-1 block text-xs text-ink-500">{row.label}</span>
              </p>
              <span aria-hidden="true" className="relative flex justify-center">
                <span
                  className={`absolute w-px bg-ink-200 ${i === 0 ? "top-3" : "top-0"} ${
                    i === rows.length - 1 ? "h-3" : "bottom-0"
                  }`}
                />
                <span className="relative mt-2 size-2.5 rounded-full border border-ink-400 bg-white" />
              </span>
              <p
                className={`pb-6 font-words text-lg leading-[1.6] text-slate-900 ${
                  row.id === "principle" ? "italic" : ""
                }`}
              >
                <span className="sr-only">{row.label}: </span>
                {row.text.map((piece, j) =>
                  typeof piece === "string" ? (
                    piece
                  ) : (
                    <span key={j} className="pen-figure">
                      {piece.figure}
                    </span>
                  ),
                )}
              </p>
              <p className="col-start-3 -mt-4 pb-6 text-sm text-accent-700 sm:col-start-auto sm:mt-0 sm:pt-1.5">
                + {row.added}
              </p>
            </li>
          ))}
        </ol>
      </figure>
    </div>
  );
}
