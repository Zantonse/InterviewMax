"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { startStory } from "@/app/stories/new/actions";
import type { LibraryEntry, LibrarySource } from "@/lib/questions/library";
import { questionKey } from "@/lib/questions/library";

export type LibraryItem = LibraryEntry & {
  coverage:
    | { kind: "story"; storyId: string; title: string; drafted: boolean }
    | { kind: "build"; storyType: string; label: string };
};

type Show = "all" | "mine" | "gaps";

// Browsing the library: search, a theme, and "for my jobs" or "no story yet". Filtering happens in
// the browser; the list is small.
export function LibraryView({
  items,
  themes,
}: {
  items: LibraryItem[];
  themes: { id: string; label: string }[];
}) {
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState("");
  const [show, setShow] = useState<Show>("all");

  const shown = useMemo(() => {
    const q = questionKey(query);
    return items.filter(
      (i) =>
        (!theme || i.theme === theme) &&
        (!q || questionKey(i.question).includes(q)) &&
        (show !== "mine" || i.sources.some((s) => s.kind !== "library")) &&
        (show !== "gaps" || i.coverage.kind === "build" || !i.coverage.drafted),
    );
  }, [items, query, theme, show]);

  const mine = items.filter((i) => i.sources.some((s) => s.kind !== "library")).length;

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions"
          aria-label="Search questions"
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 sm:max-w-xs"
          data-testid="library-search"
        />
        <div className="flex flex-wrap rounded-lg bg-ink-50 p-0.5 text-sm" role="group" aria-label="Show">
          {(
            [
              ["all", "All"],
              ["mine", `For my jobs and interviews${mine ? ` (${mine})` : ""}`],
              ["gaps", "No story yet"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setShow(id)}
              aria-pressed={show === id}
              className={`rounded-md px-3 py-1 font-medium transition ${
                show === id
                  ? "bg-white text-slate-900 ring-1 ring-ink-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm" role="group" aria-label="Theme">
        <ThemeFilter active={!theme} onClick={() => setTheme("")}>
          Every theme
        </ThemeFilter>
        {themes.map((t) => (
          <ThemeFilter key={t.id} active={theme === t.id} onClick={() => setTheme(t.id)}>
            {t.label}
          </ThemeFilter>
        ))}
      </div>

      <p className="mt-6 text-sm text-slate-600" data-testid="library-count">
        {shown.length} {shown.length === 1 ? "question" : "questions"}
      </p>
      {shown.length === 0 ? (
        <p className="mt-4 text-slate-600">No questions match. Try another theme or search.</p>
      ) : (
        <div className="mt-2 border-t border-ink-200">
          <div
            className="hidden grid-cols-[minmax(0,1fr)_10rem_15rem_7.5rem] gap-x-6 border-b border-ink-100 py-2 text-xs text-slate-600 md:grid"
            aria-hidden="true"
          >
            <span>Question</span>
            <span>Theme</span>
            <span>Story that answers it</span>
            <span />
          </div>
          <ul className="divide-y divide-ink-100" data-testid="library-list">
            {shown.map((item) => (
              <li
                key={questionKey(item.question)}
                className="grid gap-x-6 gap-y-1 py-3 md:grid-cols-[minmax(0,1fr)_10rem_15rem_7.5rem] md:items-baseline"
              >
                <div className="min-w-0">
                  <p className="font-words text-[1.0625rem] leading-snug text-slate-900">
                    {item.question}
                  </p>
                  <Sources sources={item.sources} />
                </div>
                <p className="text-sm text-slate-600">
                  {themes.find((t) => t.id === item.theme)?.label}
                </p>
                <p className="text-sm">
                  {item.coverage.kind === "story" ? (
                    <Link
                      href={`/stories/${item.coverage.storyId}`}
                      className="text-slate-800 underline decoration-ink-200 underline-offset-2 hover:decoration-current"
                    >
                      {item.coverage.title}
                    </Link>
                  ) : (
                    <span className="text-slate-500">No story yet</span>
                  )}
                </p>
                <div className="text-sm md:text-right">
                  {item.coverage.kind === "build" ? (
                    <form action={startStory}>
                      <input type="hidden" name="asked" value={item.question} />
                      <button
                        type="submit"
                        name="storyType"
                        value={item.coverage.storyType}
                        className="link"
                        title={`Build “${item.coverage.label}”`}
                      >
                        Build a story
                      </button>
                    </form>
                  ) : !item.coverage.drafted ? (
                    <Link href={`/stories/${item.coverage.storyId}`} className="link">
                      Finish it
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Where a question comes from, when it's more than the common list: a job it's likely for, an
// interview you were asked it in, or what others were asked at that company.
function Sources({ sources }: { sources: LibrarySource[] }) {
  const shown = sources.filter((s) => s.kind !== "library" || s.senior);
  if (shown.length === 0) return null;
  return (
    <p className="mt-0.5 text-xs text-slate-600">
      {shown.map((s, i) => (
        <span key={i}>
          {i > 0 && " · "}
          <Source source={s} />
        </span>
      ))}
    </p>
  );
}

function Source({ source }: { source: LibrarySource }) {
  if (source.kind === "library") return <>Senior roles</>;
  if (source.kind === "bank") return <>{source.label}</>;
  if (source.kind === "job") {
    return (
      <Link href={`/jobs/${source.jobId}`} className="hover:text-slate-900 hover:underline">
        Likely for {source.title}
      </Link>
    );
  }
  return (
    <Link href={`/transcripts/${source.transcriptId}`} className="hover:text-slate-900 hover:underline">
      Asked you in {source.title}
    </Link>
  );
}

// A theme as a text filter: the picked one in ink with the coach's underline.
function ThemeFilter({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`py-0.5 transition ${
        active
          ? "font-medium text-slate-900 underline decoration-accent-700 decoration-2 underline-offset-[6px]"
          : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}
