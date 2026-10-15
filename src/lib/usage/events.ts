// Usage events (PRD v0.3, "Usage tracking and admin panel"). An event is a user id, one of these
// names and a time, nothing else: never story text, numbers or uploads.
// Adding a name here also needs it added to the check on public.usage_events.event.
export const USAGE_EVENTS = [
  "sign_up",
  "assessment_done",
  "job_added",
  "likely_questions_shown",
  "story_finder_used",
  "story_started",
  "story_finished",
  "story_graded",
  "about_me_finished",
  "prep_plan_set",
] as const;

export type UsageEvent = (typeof USAGE_EVENTS)[number];

export const EVENT_LABELS: Record<UsageEvent, string> = {
  sign_up: "Signed up",
  assessment_done: "Finished the journey check",
  job_added: "Added a job",
  likely_questions_shown: "Saw likely questions",
  story_finder_used: "Used the story finder",
  story_started: "Started a story",
  story_finished: "Finished a story",
  story_graded: "Got a story graded",
  about_me_finished: "Finished About me",
  prep_plan_set: "Set an interview date",
};

export function isUsageEvent(value: unknown): value is UsageEvent {
  return typeof value === "string" && (USAGE_EVENTS as readonly string[]).includes(value);
}
