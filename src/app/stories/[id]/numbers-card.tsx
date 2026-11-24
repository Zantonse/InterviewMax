import Link from "next/link";
import type { StoryNumber } from "@/lib/numbers/checklist";

// Beside the questions: the checklist numbers that fit this story. Filled-in ones are the user's
// own figures, so the writer can use them; the follow-up questions ask for the rest.
const SHOWN = 5;

export function NumbersCard({ role, numbers }: { role: string | null; numbers: StoryNumber[] }) {
  if (role === null) {
    return (
      <section className="border-t border-ink-100 pt-6" data-testid="story-numbers">
        <p className="text-sm leading-relaxed text-slate-600">
          Stories land harder with numbers.{" "}
          <Link href="/numbers" className="link">
            See which ones interviewers expect for your role
          </Link>
        </p>
      </section>
    );
  }
  if (numbers.length === 0) return null;
  const shown = numbers.slice(0, SHOWN);
  return (
    <section className="border-t border-ink-100 pt-6" data-testid="story-numbers">
      <h2 className="text-sm font-semibold text-slate-900">Numbers for this story</h2>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {shown.map((n) => (
          <li key={n.id} className="flex items-baseline gap-2.5">
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 -translate-y-px rounded-full ${
                n.value ? "bg-emerald-600" : "border border-amber-600"
              }`}
            />
            <span className={n.value ? "text-slate-900" : "text-slate-600"}>
              {n.label}
              {n.value ? (
                <span className="font-mono tabular-nums">: {n.value}</span>
              ) : (
                <span className="sr-only"> (not added yet)</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <Link href="/numbers" className="link mt-3 inline-block text-sm">
        {shown.some((n) => !n.value) ? "Add your numbers" : "Edit your numbers"}
      </Link>
    </section>
  );
}
