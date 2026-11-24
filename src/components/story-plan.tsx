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
    <ol className="divide-y divide-ink-100" data-testid="story-plan" data-stagger>
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
            className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-3"
          >
            <span className="font-mono text-sm text-slate-500">{i + 1}</span>
            <span className="min-w-0">
              <span className="block font-medium text-slate-900">{type.label}</span>
              {p.why && <span className="block text-sm text-slate-600">{p.why}</span>}
            </span>
            {story ? (
              <Link
                href={`/stories/${story.id}`}
                className={
                  drafted
                    ? "text-sm text-slate-600 underline decoration-ink-200 underline-offset-2 hover:decoration-current"
                    : "link text-sm"
                }
              >
                {drafted ? "Draft written" : "Continue"}
              </Link>
            ) : (
              <form action={startStory}>
                <button type="submit" name="storyType" value={type.id} className="link text-sm">
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
