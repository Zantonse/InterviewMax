"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  LEVELS,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  RESUME_EXTENSIONS,
} from "@/lib/jobs/content";
import { POSTING_FILE_ACCEPT, postingFileKind } from "@/lib/jobs/posting-file";
import { SUPPORTED_SITES } from "@/lib/jobs/posting-sources";
import { MAX_REPORTS_LENGTH } from "@/lib/questions/content";
import {
  addJob,
  confirmLevel,
  fetchJobPosting,
  predictLikelyQuestions,
  readJobPostingFile,
  rereadJobs,
  saveResume,
  type FormState,
} from "./actions";
import { postingUpload } from "./posting-upload";

const INPUT =
  "mt-1 w-full rounded-xl border-0 bg-white px-3 py-2.5 text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-navy-700 focus:outline-none";
const PRIMARY =
  "rounded-xl bg-navy-800 px-4 py-2.5 font-semibold text-white transition hover:bg-navy-900 disabled:opacity-60";
const SECONDARY =
  "rounded-xl px-4 py-2.5 font-semibold text-navy-800 ring-1 ring-navy-800/20 transition hover:bg-navy-50 disabled:opacity-60";

// Where the add-job form was filled in from.
type Source = "link" | "pdf" | "page" | "screenshot";
const SOURCE_LABEL: Record<Source, string> = {
  link: "link",
  pdf: "PDF",
  page: "saved page",
  screenshot: "screenshots",
};

export function AddJobForm({ submitLabel = "Add this job" }: { submitLabel?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addJob, null);
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Where the form was last filled in from, to say so.
  const [fetched, setFetched] = useState<null | Source>(null);
  const [fetching, startFetch] = useTransition();
  const [fetchingFrom, setFetchingFrom] = useState<Source>("link");
  const id = useId();

  function fill(from: Source, load: () => ReturnType<typeof fetchJobPosting>) {
    setFetchError(null);
    setFetched(null);
    setFetchingFrom(from);
    startFetch(async () => {
      const result = await load();
      if (!result.ok) {
        setFetchError(result.error);
        return;
      }
      // Keep what the user already typed when the source doesn't give it.
      if (result.posting.title) setTitle(result.posting.title);
      if (result.posting.company) setCompany(result.posting.company);
      setDescription(result.posting.description);
      setFetched(from);
    });
  }

  function fetchLink() {
    if (!link.trim()) return;
    fill("link", () => fetchJobPosting(link));
  }

  function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    const kind = postingFileKind(files[0].name);
    fill(kind === "image" ? "screenshot" : kind === "page" ? "page" : "pdf", async () => {
      try {
        return await readJobPostingFile(await postingUpload(files));
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "That file couldn't be read.",
        };
      }
    });
  }

  return (
    <form action={action} className="space-y-4" data-testid="add-job-form">
      <p className="text-sm text-slate-600">
        Add a link, upload the posting or paste it below: any one is enough.
      </p>
      <div>
        <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-link`}>
          Link to the posting
        </label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            id={`${id}-link`}
            name="link"
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                fetchLink();
              }
            }}
            placeholder="https://jobs.lever.co/…"
            className={INPUT.replace("mt-1 ", "")}
          />
          <button
            type="button"
            onClick={fetchLink}
            disabled={fetching || !link.trim()}
            className={`${SECONDARY} shrink-0`}
          >
            {fetching && fetchingFrom === "link" ? "Fetching…" : "Fetch posting"}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Works best with {SUPPORTED_SITES.join(", ")} and most company career pages. LinkedIn,
          Indeed and Glassdoor block links: save the posting as a file and upload it below, or
          paste the text.
        </p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-file`}>
          Or upload the posting as a PDF, web page or screenshots
        </label>
        <input
          id={`${id}-file`}
          type="file"
          multiple
          accept={POSTING_FILE_ACCEPT}
          disabled={fetching}
          onChange={(e) => {
            uploadFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
          className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:font-semibold file:text-navy-900"
        />
        <p className="mt-1 text-xs text-slate-500">
          {fetching && fetchingFrom !== "link"
            ? `Reading the ${SOURCE_LABEL[fetchingFrom]}…`
            : "On the posting, use your browser's Print, then Save as PDF; or Save page as; or take screenshots of the whole posting (pick them all at once). Works for LinkedIn, Indeed and Glassdoor."}
        </p>
      </div>
      {fetchError && <ErrorLine>{fetchError}</ErrorLine>}
      {fetched && (
        <p className="text-sm font-medium text-navy-800" role="status">
          {fetched === "screenshot"
            ? "Read from your screenshots. Check each line against the posting, then add the job."
            : `Filled in from the ${SOURCE_LABEL[fetched]}. Check it over, then add the job.`}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-title`}>
          Job title <span className="font-normal text-slate-500">(optional)</span>
          <input
            id={`${id}-title`}
            name="title"
            maxLength={MAX_TITLE_LENGTH}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior Solutions Engineer"
            className={INPUT}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-company`}>
          Company <span className="font-normal text-slate-500">(optional)</span>
          <input
            id={`${id}-company`}
            name="company"
            maxLength={MAX_TITLE_LENGTH}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Acme"
            className={INPUT}
          />
        </label>
      </div>
      <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-description`}>
        The job posting{" "}
        <span className="font-normal text-slate-500">(not needed with a link or upload)</span>
        <textarea
          id={`${id}-description`}
          name="description"
          rows={10}
          maxLength={MAX_DESCRIPTION_LENGTH}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Paste the whole posting, or fill it in from a link or file above: the responsibilities and requirements are what I read."
          className={INPUT}
        />
      </label>
      {state?.error && <ErrorLine>{state.error}</ErrorLine>}
      <button type="submit" disabled={pending || fetching} className={PRIMARY}>
        {pending ? "Reading the posting and predicting your questions…" : submitLabel}
      </button>
    </form>
  );
}

export function ResumeForm({ hasResume }: { hasResume: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveResume, null);
  const id = useId();
  return (
    <form action={action} className="space-y-3" data-testid="resume-form">
      <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-file`}>
        {hasResume ? "Replace it with a file" : "Upload your resume"}
        <input
          id={`${id}-file`}
          type="file"
          name="file"
          accept={RESUME_EXTENSIONS.join(",")}
          className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:font-semibold file:text-navy-900"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-text`}>
        Or paste it
        <textarea id={`${id}-text`} name="text" rows={4} className={INPUT} />
      </label>
      {state?.error && <ErrorLine>{state.error}</ErrorLine>}
      <button type="submit" disabled={pending} className={SECONDARY}>
        {pending ? "Reading your resume…" : "Save resume"}
      </button>
    </form>
  );
}

export function RereadButton() {
  const [state, action, pending] = useActionState<FormState>(rereadJobs, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className={PRIMARY}>
        {pending ? "Reading your jobs…" : "Read my jobs again"}
      </button>
      {state?.error && <ErrorLine>{state.error}</ErrorLine>}
    </form>
  );
}

// Predicts a job's likely questions. Pasted interview reports are optional and saved with the job.
export function PredictForm({
  jobId,
  reports,
  predicted,
}: {
  jobId: string;
  reports: string;
  predicted: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(predictLikelyQuestions, null);
  const id = useId();
  return (
    <form action={action} className="space-y-3" data-testid="predict-form">
      <input type="hidden" name="jobId" value={jobId} />
      <details open={!predicted && Boolean(reports)}>
        <summary className="cursor-pointer text-sm font-semibold text-navy-800">
          {reports ? "Interview reports you added" : "Add interview reports (optional)"}
        </summary>
        <label className="mt-2 block text-sm text-slate-600" htmlFor={id}>
          Paste what people say they were asked at this company or for this role, from Glassdoor,
          Blind, Reddit or a friend. I&apos;ll put the behavioral questions they mention on the list.
          <textarea
            id={id}
            name="reports"
            rows={6}
            defaultValue={reports}
            maxLength={MAX_REPORTS_LENGTH}
            className={INPUT}
          />
        </label>
      </details>
      {state?.error && <ErrorLine>{state.error}</ErrorLine>}
      <button type="submit" disabled={pending} className={predicted ? SECONDARY : PRIMARY}>
        {pending
          ? "Predicting your questions…"
          : predicted
            ? "Predict again"
            : "Predict my likely questions"}
      </button>
    </form>
  );
}

export function LevelForm({
  jobId,
  level,
  confirmed,
}: {
  jobId: string;
  level: string | null;
  confirmed: boolean;
}) {
  const id = useId();
  return (
    <form action={confirmLevel} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="jobId" value={jobId} />
      <label className="block text-sm font-semibold text-slate-700" htmlFor={id}>
        {confirmed ? "Level" : "Level (suggested from the title)"}
        <select id={id} name="level" defaultValue={level ?? "mid"} className={INPUT}>
          {LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <LevelButton confirmed={confirmed} />
    </form>
  );
}

function LevelButton({ confirmed }: { confirmed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={SECONDARY}>
      {pending ? "Saving…" : confirmed ? "Change" : "That's right"}
    </button>
  );
}

export function PendingButton({
  children,
  pendingText,
  className = SECONDARY,
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium text-red-700" role="alert">
      {children}
    </p>
  );
}
