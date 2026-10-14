import Link from "next/link";
import { startStory } from "@/app/stories/new/actions";
import type { StoryPriority } from "@/lib/jobs/content";
import { hasDraft } from "@/lib/stories/content";
import type { StoryRecord } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";

// The stories the user's target jobs need, most needed first, each with where the user is on it.
export function StoryPlan({
  order,
  stories,
  limit,
}: {
  order: StoryPriority[];
  stories: StoryRecord[];
  limit?: number;
}) {
  return (
    <ol className="space-y-2" data-testid="story-plan">
      {order.slice(0, limit).map((p, i) => {
        const type = getStoryType(p.storyType);
        if (!type) return null;
        // listStories is newest first; prefer a drafted one.
        const mine = stories.filter((s) => s.storyType === type.id);
        const story = mine.find((s) => hasDraft(s.content)) ?? mine[0] ?? undefined;
        const drafted = story && hasDraft(story.content);
        return (
          <li
            key={type.id}
            className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5"
          >
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900">
                <span className="mr-2 text-navy-800">{i + 1}.</span>
                {type.label}
              </span>
              {p.why && <span className="block text-sm text-slate-600">{p.why}</span>}
            </span>
            {story ? (
              <Link
                href={`/stories/${story.id}`}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  drafted
                    ? "bg-navy-800 text-white"
                    : "bg-navy-50 text-navy-900 ring-1 ring-navy-800/20"
                }`}
              >
                {drafted ? "Draft written" : "In progress"}
              </Link>
            ) : (
              <form action={startStory} className="shrink-0">
                <button
                  type="submit"
                  name="storyType"
                  value={type.id}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-navy-800 ring-1 ring-navy-800/30 hover:bg-navy-50"
                >
                  Start
                </button>
              </form>
            )}
          </li>
        );
      })}
    </ol>
  );
}
