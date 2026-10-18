"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { NavIcon } from "./nav-icons";

// The sidebar's "Build a story". On the home page it's an outline, so the plan's Continue is the
// one main button there; everywhere else it's the main action.
export function BuildStoryLink() {
  return (
    <Suspense fallback={<BuildStoryLinkBody home={false} />}>
      <BuildStoryLinkOnPath />
    </Suspense>
  );
}

function BuildStoryLinkOnPath() {
  return <BuildStoryLinkBody home={usePathname() === "/"} />;
}

function BuildStoryLinkBody({ home }: { home: boolean }) {
  return (
    <Link
      href="/stories/new"
      title="Build a story"
      className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
        home
          ? "text-accent-300 ring-1 ring-accent-400/70 hover:bg-white/10"
          : "bg-accent-400 text-ink-950 hover:bg-accent-300"
      }`}
      data-testid="build-story-link"
    >
      <NavIcon name="plus" />
      <span className="nav-collapsed:sr-only">Build a story</span>
    </Link>
  );
}
