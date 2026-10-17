"use client";

import { useId, useState, useTransition } from "react";
import { CopyButton } from "@/components/copy-button";
import { MicButton } from "@/components/mic-button";
import type { TailoredIntro } from "@/lib/stories/content";
import { CHECKS, countWords } from "@/lib/stories/grading";
import { TAILORED_PARTS } from "@/lib/stories/story-types";
import { MAX_WHY_COMPANY_LENGTH, tailoredChecks } from "@/lib/stories/tailored";
import { appendSpoken } from "@/lib/voice/text";
import { pickTailoredClosing, writeTailoredIntro } from "./about-me-actions";

// "Tell me about yourself" for this job, company first: why this company, in the user's words,
// then a three-beat answer built around the one proof point this job most needs to hear.
export function TailoredIntroPanel({
  jobId,
  company,
  initial,
}: {
  jobId: string;
  company: string;
  initial: TailoredIntro | undefined;
}) {
  const [tailored, setTailored] = useState(initial);
  const [why, setWhy] = useState(initial?.whyCompany ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [picking, startPicking] = useTransition();
  const [talking, setTalking] = useState(false);
  const fieldId = useId();

  const draft = tailored?.draft;
  const paragraphs = draft ? TAILORED_PARTS.map((p) => draft.parts[p.id]).filter(Boolean) : [];
  const words = countWords(paragraphs.join(" "));
  const seconds = Math.round(((words / 150) * 60) / 5) * 5;
  const checks = draft ? tailoredChecks(draft) : [];
  const failed = checks.filter((c) => !c.pass);
  const changed = why.trim() !== (tailored?.whyCompany ?? "").trim();

  function write() {
    setError(null);
    startTransition(async () => {
      const result = await writeTailoredIntro(jobId, why);
      if (result.ok) setTailored(result.tailored);
      else setError(result.error);
    });
  }

  function pickClosing(picked: "role" | "company") {
    if (!draft?.closings || draft.closings.picked === picked) return;
    setError(null);
    // Show the pick straight away; the saved copy follows.
    setTailored({
      ...tailored!,
      draft: {
        ...draft,
        closings: { ...draft.closings, picked },
        parts: { ...draft.parts, why_here: draft.closings[picked] },
      },
    });
    startPicking(async () => {
      const result = await pickTailoredClosing(jobId, picked);
      if (result.ok) setTailored(result.tailored);
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4" data-testid="tailored-intro">
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (why.trim() && !pending && !talking) write();
        }}
      >
        <label htmlFor={fieldId} className="text-slate-800">
          <span className="font-semibold">Why {company}?</span> What draws you to this team or this
          role? One or two reasons in your own words is plenty.
        </label>
        <textarea
          id={fieldId}
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          rows={3}
          maxLength={MAX_WHY_COMPANY_LENGTH}
          placeholder="Type or tap Talk. Plain notes are fine."
          className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-ink-600 focus:bg-white focus:ring-2 focus:ring-ink-600/20"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || talking || !why.trim()}
            className="rounded-xl bg-ink-800 px-4 py-2.5 font-semibold text-white transition hover:bg-ink-900 disabled:opacity-60"
          >
            {pending
              ? "Writing it for this job…"
              : draft && !changed
                ? "Rewrite it"
                : `Write it for ${company}`}
          </button>
          <MicButton
            disabled={pending}
            onActiveChange={setTalking}
            onText={(spoken) => setWhy((w) => appendSpoken(w, spoken, MAX_WHY_COMPANY_LENGTH))}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </form>

      {draft && (
        <div className={`flex flex-col gap-3 ${pending ? "opacity-60" : ""}`}>
          {draft.angle && <p className="text-sm text-slate-600">{draft.angle}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <span data-testid="tailored-length">
              {words} words, about {seconds < 60 ? `${seconds} seconds` : formatMinutes(seconds)}{" "}
              spoken
            </span>
            <CopyButton
              text={paragraphs.join("\n\n")}
              className="rounded-full px-3 py-1.5 font-medium text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50"
            />
          </div>
          <div
            className="flex flex-col gap-4 text-lg leading-relaxed text-slate-800"
            data-testid="tailored-script"
          >
            {paragraphs.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </div>
          {draft.closings && (
            <ClosingPicker
              company={company}
              closings={draft.closings}
              disabled={pending || picking}
              onPick={pickClosing}
            />
          )}
          {failed.length === 0 ? (
            <p className="text-sm font-medium text-ink-800">
              ✓ Under 90 seconds, one or two key figures all from your answers, no filler or unsure
              figures.
            </p>
          ) : (
            <ul
              className="flex flex-col gap-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
              data-testid="tailored-flags"
            >
              {failed.map((c) => (
                <li key={c.id}>
                  <span className="font-semibold">{CHECKS.find((k) => k.id === c.id)?.label}:</span>{" "}
                  {c.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// The closing line is optional territory: a career coach called tailoring it to a company's
// challenges a gamble (tester feedback, Oct 16). The safe one is picked by default.
function ClosingPicker({
  company,
  closings,
  disabled,
  onPick,
}: {
  company: string;
  closings: { role: string; company: string; picked: "role" | "company" };
  disabled: boolean;
  onPick: (picked: "role" | "company") => void;
}) {
  const options = [
    { id: "role", label: "About the role", hint: "Safe with any interviewer", text: closings.role },
    {
      id: "company",
      label: `About ${company}`,
      hint: "Bolder: some interviewers love it, some find it presumptuous",
      text: closings.company,
    },
  ] as const;
  return (
    <fieldset className="flex flex-col gap-2" data-testid="closing-picker">
      <legend className="text-sm font-semibold text-slate-800">How to end it</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const picked = closings.picked === o.id;
          return (
            <label
              key={o.id}
              className={`flex cursor-pointer flex-col gap-1 rounded-xl p-3 text-sm ring-1 ${
                picked ? "bg-ink-50 ring-ink-800/40" : "bg-white ring-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="closing"
                  checked={picked}
                  disabled={disabled}
                  onChange={() => onPick(o.id)}
                />
                <span className="font-semibold text-slate-900">{o.label}</span>
              </span>
              <span className="text-xs text-slate-500">{o.hint}</span>
              <span className="text-slate-700">{o.text}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function formatMinutes(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} sec` : `${m} min`;
}
