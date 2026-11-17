"use client";

import { useEffect, useState } from "react";
import { JOB_TABS, tabFor, type JobTabId } from "./tabs";

export type JobTab = { id: JobTabId; label: string; note?: string };

// The tab bar on a target job page. Which tab shows is kept on <html data-job-tab>, so CSS in
// globals.css hides the other panels with no flash: the inline script in the page sets it from the
// URL hash before paint, and this component keeps it in step as links are followed. A hash can
// name a tab (#pitch) or any section inside one (#about-me), so older links still land.
export function JobTabs({ tabs }: { tabs: JobTab[] }) {
  const [active, setActive] = useState<JobTabId>("overview");

  useEffect(() => {
    function show(hash: string, scroll: boolean) {
      const id = hash.replace(/^#/, "");
      const tab = tabFor(id);
      document.documentElement.dataset.jobTab = tab;
      setActive(tab);
      if (!scroll || !id) return;
      // The section was hidden when the browser tried to jump to it, so jump now.
      const target = (JOB_TABS as readonly string[]).includes(id)
        ? document.getElementById("job-tabs")
        : document.getElementById(id);
      target?.scrollIntoView({ block: "start" });
    }
    show(window.location.hash, false);
    const onHash = () => show(window.location.hash, true);
    // Following a link to the hash already in the URL fires no hashchange, so catch the click too.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href^='#']");
      if (a && a.getAttribute("href") === window.location.hash) {
        e.preventDefault();
        show(window.location.hash, true);
      }
    };
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
      delete document.documentElement.dataset.jobTab;
    };
  }, []);

  return (
    <nav
      id="job-tabs"
      aria-label="This job"
      className="sticky top-0 z-10 -mx-4 mt-6 scroll-mt-0 border-b border-slate-200 bg-[var(--background)]/95 px-4 backdrop-blur sm:mx-0 sm:px-0"
      data-testid="job-tabs"
    >
      {/* On phones the tabs sit in a 2x2 grid so none is cut off (design review 2026-11-16, fix 8). */}
      <ul className="grid grid-cols-2 gap-x-1 sm:flex sm:gap-1 sm:overflow-x-auto sm:[scrollbar-width:none]">
        {tabs.map((t) => (
          <li key={t.id} className="min-w-0 sm:shrink-0">
            <a
              href={`#${t.id}`}
              aria-current={active === t.id ? "page" : undefined}
              data-tab-link={t.id}
              className="-mb-px flex h-full flex-col items-center justify-center gap-x-1.5 border-b-2 border-transparent px-3 py-2.5 text-center text-sm sm:flex-row sm:items-baseline sm:justify-start sm:py-3 sm:text-left font-semibold text-slate-600 transition hover:text-slate-900"
            >
              {t.label}
              {t.note && <span className="whitespace-nowrap text-xs font-normal text-slate-600 sm:text-sm">{t.note}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
