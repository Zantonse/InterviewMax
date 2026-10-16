-- More usage events, so the admin panel sees every feature, not just jobs and stories.
-- Names only, as before: never what the user wrote.
alter table public.usage_events drop constraint if exists usage_events_event_check;
alter table public.usage_events add constraint usage_events_event_check check (event in (
  'sign_up', 'assessment_done', 'job_added', 'likely_questions_shown', 'story_finder_used',
  'story_started', 'story_finished', 'story_graded', 'about_me_finished', 'prep_plan_set',
  'transcript_added', 'practice_started', 'practice_answered', 'tough_question_started',
  'about_me_tailored', 'questions_to_ask_made', 'resume_bullets_made', 'brief_opened',
  'warm_up_opened'
));
