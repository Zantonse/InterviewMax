-- Interviewee profile (PRD v0.3, P0). The profile is worked out in code from the user's own data on
-- every visit; this column keeps only the summary the model last wrote (with a hash of what it was
-- written from) and the two latest snapshots of the scores, for "since you last looked". It sits on
-- the user's own profile row, so the existing owner-only policies cover it and deleting the
-- account deletes it. The admin panel never reads it. Safe to run more than once.
alter table public.profiles add column if not exists interviewee_profile jsonb;

-- The new usage event: that someone opened their profile, never what it says.
alter table public.usage_events drop constraint if exists usage_events_event_check;
alter table public.usage_events add constraint usage_events_event_check check (event in (
  'sign_up', 'assessment_done', 'job_added', 'likely_questions_shown', 'story_finder_used',
  'story_started', 'story_finished', 'story_graded', 'about_me_finished', 'prep_plan_set',
  'transcript_added', 'practice_started', 'practice_answered', 'tough_question_started',
  'about_me_tailored', 'questions_to_ask_made', 'resume_bullets_made', 'brief_opened',
  'warm_up_opened', 'profile_opened'
));
