import { answerProblem } from "@/lib/text/answer";

// Under an answer box: a quiet character count once the answer nears its limit, and a plain
// message when it can't be sent (too long, or no words in it). Answer boxes don't cut text at the
// limit any more, so nothing pasted or spoken is lost without the user seeing why.
export function AnswerLimit({ text, max }: { text: string; max: number }) {
  const problem = answerProblem(text, max);
  if (problem) {
    return (
      <p role="alert" className="text-sm text-red-700" data-testid="answer-problem">
        {problem}
      </p>
    );
  }
  const length = text.trim().length;
  if (length < max * 0.8) return null;
  return (
    <p className="text-right text-xs text-slate-500 tabular-nums" data-testid="answer-count">
      {length.toLocaleString("en-US")} / {max.toLocaleString("en-US")} characters
    </p>
  );
}
