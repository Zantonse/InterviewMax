-- Several roles at one company in one target job. The job's own title, level and posting are the
-- main role; other_roles holds the others ([{id, title, level, levelConfirmed, description,
-- addedAt}], at most 3). offered_role says which role the outcome was for. target_jobs already
-- has user_id and RLS, so no new policies. Plus a usage event.
alter table public.target_jobs add column if not exists other_roles jsonb not null default '[]'::jsonb;
alter table public.target_jobs add column if not exists offered_role text;

alter table public.target_jobs drop constraint if exists target_jobs_other_roles_check;
alter table public.target_jobs add constraint target_jobs_other_roles_check
  check (jsonb_typeof(other_roles) = 'array' and jsonb_array_length(other_roles) <= 3);
alter table public.target_jobs drop constraint if exists target_jobs_offered_role_check;
alter table public.target_jobs add constraint target_jobs_offered_role_check
  check (offered_role is null or char_length(offered_role) <= 200);

alter table public.usage_events drop constraint if exists usage_events_event_check;
alter table public.usage_events add constraint usage_events_event_check check (event in (
  'sign_up', 'assessment_done', 'job_added', 'likely_questions_shown', 'story_finder_used',
  'story_started', 'story_told', 'story_finished', 'story_graded', 'about_me_finished',
  'prep_plan_set', 'transcript_added', 'practice_started', 'practice_answered',
  'tough_question_started', 'about_me_tailored', 'questions_to_ask_made', 'resume_bullets_made',
  'brief_opened', 'warm_up_opened', 'profile_opened', 'questions_shared',
  'screen_practice_started', 'tough_drill_started', 'curriculum_made', 'job_finished',
  'ai_answer_for_job', 'job_role_added'
));
