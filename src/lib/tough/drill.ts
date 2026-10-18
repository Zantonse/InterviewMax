import { type PracticeItem, parseItems } from "@/lib/practice/content";
import type { StoryContent } from "@/lib/stories/content";
import type { ToughQuestion } from "./questions";

// The tough-questions drill (PRD, interview trends 2026): once the short answer is written, the
// user says it out loud and an interviewer pushes back two or three times, the way real ones do
// when an answer sounds rehearsed. Feedback says where it held and where it got thinner. It reuses
// practice mode's turns and feedback; the latest drill is kept on content.tough.drill.

// The drill as saved, or null when there isn't one.
export function toughDrill(content: StoryContent): PracticeItem | null {
  return parseItems([content.tough?.drill])[0] ?? null;
}

// A new drill on a tough question: the question first, with nothing answered yet.
export function newToughDrill(question: ToughQuestion): PracticeItem {
  return {
    question: question.label,
    theme: "tough",
    // Not shown for a drill: there is no round to rank it in.
    reason: "good_enough",
    turns: [{ question: question.label }],
  };
}

// The prepared answer and the situation behind it, for the feedback to compare against.
export function drillReference(
  question: ToughQuestion,
  content: StoryContent,
): { title: string; script: string; answers: string } | undefined {
  const script = content.draft?.parts.answer?.trim();
  if (!script) return undefined;
  const answers = question.prompts
    .flatMap((p) => {
      const a = content.answers[p.id]?.trim();
      return a ? [`Q: ${p.text}\nA: ${a}`] : [];
    })
    .join("\n\n");
  return { title: question.label, script, answers };
}
