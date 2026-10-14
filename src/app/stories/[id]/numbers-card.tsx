import Link from "next/link";
import type { StoryNumber } from "@/lib/numbers/checklist";

// Beside the chat: the checklist numbers that fit this story. Filled-in ones are the user's own
// figures, so the writer can use them; the follow-up questions ask for the rest.
const SHOWN = 5;

export function NumbersCard({ role, numbers }: { role: string | null; numbers: StoryNumber[] }) {
  if (role === null) {
    return (
      <section
        className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"
        data-testid="story-numbers"
      >
        <h2 className="text-xs font-bold uppercase tracking-wide text-navy-800">Your numbers</h2>
        <p className="mt-2 text-sm text-slate-600">
          Stories land harder with numbers. See which ones interviewers expect for your role.
        </p>
        <Link
          href="/numbers"
          className="mt-3 inline-block text-sm font-medium text-navy-800 hover:underline"
        >
          Gather your numbers →
        </Link>
      </section>
    );
  }
  if (numbers.length === 0) return null;
  const shown = numbers.slice(0, SHOWN);
  return (
    <section
      className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"
      data-testid="story-numbers"
    >
      <h2 className="text-xs font-bold uppercase tracking-wide text-navy-800">
        Numbers for this story
      </h2>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {shown.map((n) => (
          <li key={n.id} className="flex items-start gap-2">
            <span
              className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                n.value ? "bg-emerald-600" : "border-2 border-amber-500"
              }`}
            />
            <span className={n.value ? "text-slate-900" : "text-slate-600"}>
              {n.label}
              {n.value && <span className="font-semibold">: {n.value}</span>}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/numbers"
        className="mt-3 inline-block text-sm font-medium text-navy-800 hover:underline"
      >
        {shown.some((n) => !n.value) ? "Fill in your numbers →" : "Edit your numbers →"}
      </Link>
    </section>
  );
}
