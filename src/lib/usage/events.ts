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
  "story_told",
  "story_finished",
  "story_graded",
  "about_me_finished",
  "prep_plan_set",
  "transcript_added",
  "practice_started",
  "practice_answered",
  "tough_question_started",
  "about_me_tailored",
  "questions_to_ask_made",
  "resume_bullets_made",
  "brief_opened",
  "warm_up_opened",
  "profile_opened",
  "questions_shared",
] as const;

export type UsageEvent = (typeof USAGE_EVENTS)[number];

export const EVENT_LABELS: Record<UsageEvent, string> = {
  sign_up: "Signed up",
  assessment_done: "Finished the journey check",
  job_added: "Added a job",
  likely_questions_shown: "Saw likely questions",
  story_finder_used: "Used the story finder",
  story_started: "Started a story",
  story_told: "Told a story (rough draft)",
  story_finished: "Finished a story",
  story_graded: "Got a story graded",
  about_me_finished: "Finished About me",
  prep_plan_set: "Set an interview date",
  transcript_added: "Added a past interview",
  practice_started: "Started a practice round",
  practice_answered: "Answered a practice question",
  tough_question_started: "Started a tough question",
  about_me_tailored: "Wrote About me for a job",
  questions_to_ask_made: "Got questions to ask",
  resume_bullets_made: "Got resume bullets",
  brief_opened: "Opened a pre-interview brief",
  warm_up_opened: "Opened the warm-up",
  profile_opened: "Opened their interviewee profile",
  questions_shared: "Shared interview questions",
};

export function isUsageEvent(value: unknown): value is UsageEvent {
  return typeof value === "string" && (USAGE_EVENTS as readonly string[]).includes(value);
}
