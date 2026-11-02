-- "How do you use AI in your work?" shaped for one target job (job page, Your pitch tab). The
-- answers live in stories.content like every tough answer, so only the usage event is new.
alter table public.usage_events drop constraint if exists usage_events_event_check;
alter table public.usage_events add constraint usage_events_event_check check (event in (
  'sign_up', 'assessment_done', 'job_added', 'likely_questions_shown', 'story_finder_used',
  'story_started', 'story_told', 'story_finished', 'story_graded', 'about_me_finished',
  'prep_plan_set', 'transcript_added', 'practice_started', 'practice_answered',
  'tough_question_started', 'about_me_tailored', 'questions_to_ask_made', 'resume_bullets_made',
  'brief_opened', 'warm_up_opened', 'profile_opened', 'questions_shared',
  'screen_practice_started', 'tough_drill_started', 'curriculum_made', 'job_finished',
  'ai_answer_for_job'
));
