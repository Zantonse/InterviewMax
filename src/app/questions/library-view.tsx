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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions"
          aria-label="Search questions"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 sm:max-w-xs"
          data-testid="library-search"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {(
            [
              ["all", "All"],
              ["mine", `For my jobs and interviews${mine ? ` (${mine})` : ""}`],
              ["gaps", "No story yet"],
            ] as const
          ).map(([id, label]) => (
            <Chip key={id} active={show === id} onClick={() => setShow(id)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Theme">
        <Chip active={!theme} onClick={() => setTheme("")}>
          Every theme
        </Chip>
        {themes.map((t) => (
          <Chip key={t.id} active={theme === t.id} onClick={() => setTheme(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>

      <p className="mt-4 text-sm text-slate-500" data-testid="library-count">
        {shown.length} {shown.length === 1 ? "question" : "questions"}
      </p>
      {shown.length === 0 ? (
        <p className="mt-4 text-slate-600">No questions match. Try another theme or search.</p>
      ) : (
        <form action={startStory}>
          <ul className="mt-2 space-y-2" data-testid="library-list">
            {shown.map((item) => (
              <li
                key={questionKey(item.question)}
                className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5"
              >
                <p className="font-semibold text-slate-900">{item.question}</p>
                <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  <Tag>{themes.find((t) => t.id === item.theme)?.label}</Tag>
                  {item.sources.map((s, i) => (
                    <SourceTag key={i} source={s} />
                  ))}
                </p>
                <div className="mt-2 text-sm">
                  {item.coverage.kind === "story" ? (
                    <Link
                      href={`/stories/${item.coverage.storyId}`}
                      className="font-medium text-ink-800 hover:underline"
                    >
                      {item.coverage.drafted ? "Answer with" : "In progress"}: {item.coverage.title} →
                    </Link>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-500">No story for this yet.</span>
                      <button
                        type="submit"
                        name="storyType"
                        value={item.coverage.storyType}
                        className="font-medium text-ink-800 hover:underline"
                      >
                        Build &ldquo;{item.coverage.label}&rdquo; →
                      </button>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </form>
      )}
    </div>
  );
}

function SourceTag({ source }: { source: LibrarySource }) {
  if (source.kind === "library") return source.senior ? <Tag>Senior roles</Tag> : null;
  if (source.kind === "bank") return <Tag tone="accent">{source.label}</Tag>;
  if (source.kind === "job") {
    return (
      <Link href={`/jobs/${source.jobId}`} className="hover:underline">
        <Tag tone="accent">Likely for {source.title}</Tag>
      </Link>
    );
  }
  return (
    <Link href={`/transcripts/${source.transcriptId}`} className="hover:underline">
      <Tag tone="accent">Asked you in {source.title}</Tag>
    </Link>
  );
}

function Chip({
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
      className={`rounded-full px-3 py-1 text-sm font-medium ring-1 transition ${
        active
          ? "bg-ink-800 text-white ring-ink-800"
          : "bg-white text-slate-700 ring-slate-300 hover:bg-ink-50"
      }`}
    >
      {children}
    </button>
  );
}

function Tag({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "accent" }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 font-semibold ${
        tone === "accent" ? "bg-accent-100 text-accent-900" : "bg-ink-50 text-ink-900"
      }`}
    >
      {children}
    </span>
  );
}
