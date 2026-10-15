"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MicButton } from "@/components/mic-button";
import { MAX_PRACTICE_ANSWER_LENGTH, formatDuration } from "@/lib/practice/content";
import { appendSpoken } from "@/lib/voice/text";

// Where a practice answer is given: tap Talk and say it, or type it. The words appear as the user
// talks, so they can fix a transcription slip before sending. Recorded time is added up across
// every Talk, so the feedback can say how long the answer took; a typed answer is timed from its
// words. Shared by practice mode and any other rehearsal (e.g. the tough-questions coach).
export function AnswerComposer({
  disabled,
  submitLabel = "Send answer",
  placeholder = "Tap Talk and answer out loud, as you would in the interview. Or type it.",
  onSubmit,
  extra,
}: {
  disabled: boolean;
  submitLabel?: string;
  placeholder?: string;
  onSubmit: (answer: string, seconds: number | null) => void;
  // Shown beside the send button, e.g. "Skip this question".
  extra?: React.ReactNode;
}) {
  const [text, setText] = useState("");
  const [talking, setTalking] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const canSubmit = !disabled && !talking && text.trim().length > 0;
  const send = () => {
    if (canSubmit) onSubmit(text, seconds > 0 ? seconds : null);
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      data-testid="answer-composer"
    >
      <div className="flex flex-wrap items-center gap-3">
        <MicButton
          disabled={disabled}
          onActiveChange={setTalking}
          onRecorded={(s) => setSeconds((total) => total + s)}
          onText={(spoken) =>
            setText((t) => appendSpoken(t, spoken, MAX_PRACTICE_ANSWER_LENGTH))
          }
        />
        {seconds > 0 && !talking && (
          <span className="text-xs text-slate-500 tabular-nums">
            Recorded {formatDuration(seconds)}
          </span>
        )}
      </div>
      <label className="sr-only" htmlFor={fieldId}>
        Your answer
      </label>
      <textarea
        id={fieldId}
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        rows={4}
        maxLength={MAX_PRACTICE_ANSWER_LENGTH}
        placeholder={placeholder}
        className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-ink-600 focus:bg-white focus:ring-2 focus:ring-ink-600/20"
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {extra && <div className="mr-auto">{extra}</div>}
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-xl bg-ink-800 px-5 py-2.5 font-semibold text-white transition hover:bg-ink-900 disabled:opacity-50"
        >
          {disabled ? "Sending…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
