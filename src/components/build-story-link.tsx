import Link from "next/link";
import { NavIcon } from "./nav-icons";

// The sidebar's "Build a story", always an outline: each page's own next step is its one
// periwinkle button (button rule in globals.css, design review 2026-11-16 fix 5).
export function BuildStoryLink() {
  return (
    <Link
      href="/stories/new"
      title="Build a story"
      className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-accent-300 ring-1 ring-accent-400/70 transition hover:bg-white/10"
      data-testid="build-story-link"
    >
      <NavIcon name="plus" />
      <span className="nav-collapsed:sr-only">Build a story</span>
    </Link>
  );
}
