// The tabs on a target job page and which sections live in each. Kept out of the "use client"
// file so the page (a server component) can use them too.

export const JOB_TABS = ["overview", "prep", "interviews", "pitch"] as const;
export type JobTabId = (typeof JOB_TABS)[number];

// Every section id that other pages link to (#about-me, #questions...), by the tab that holds it.
export const SECTION_TAB: Record<string, JobTabId> = {
  level: "overview",
  focus: "overview",
  posting: "overview",
  questions: "prep",
  stories: "prep",
  cases: "prep",
  practice: "prep",
  "interview-date": "overview",
  outcome: "interviews",
  timeline: "interviews",
  "past-interviews": "interviews",
  "about-me": "pitch",
  resume: "pitch",
  ask: "pitch",
};

export function tabFor(hash: string): JobTabId {
  const id = hash.replace(/^#/, "");
  if ((JOB_TABS as readonly string[]).includes(id)) return id as JobTabId;
  return SECTION_TAB[id] ?? "overview";
}

// Runs before paint so a link like /jobs/x#about-me opens on the right tab with no flash.
export const RESTORE_TAB = `(function(){try{var h=location.hash.slice(1),t=${JSON.stringify(
  JOB_TABS,
)}.indexOf(h)>=0?h:(${JSON.stringify(SECTION_TAB)})[h]||"overview";document.documentElement.dataset.jobTab=t}catch(e){}})()`;
