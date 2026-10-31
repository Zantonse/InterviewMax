-- Interview outcome per target job: how the process ended (offer, not selected, withdrew), the
-- round reached and an optional name for it, and the day it finished. A null outcome means the
-- process is still in progress. target_jobs already has user_id and RLS. Plus a usage event.
alter table public.target_jobs add column if not exists outcome text;
alter table public.target_jobs add column if not exists round_reached smallint;
alter table public.target_jobs add column if not exists round_name text;
alter table public.target_jobs add column if not exists finished_on date;

alter table public.target_jobs drop constraint if exists target_jobs_outcome_check;
alter table public.target_jobs add constraint target_jobs_outcome_check
  check (outcome is null or outcome in ('offer', 'rejected', 'withdrew'));
alter table public.target_jobs drop constraint if exists target_jobs_round_reached_check;
alter table public.target_jobs add constraint target_jobs_round_reached_check
  check (round_reached is null or round_reached between 1 and 10);
alter table public.target_jobs drop constraint if exists target_jobs_round_name_check;
alter table public.target_jobs add constraint target_jobs_round_name_check
  check (round_name is null or char_length(round_name) <= 80);

alter table public.usage_events drop constraint if exists usage_events_event_check;
alter table public.usage_events add constraint usage_events_event_check check (event in (
  'sign_up', 'assessment_done', 'job_added', 'likely_questions_shown', 'story_finder_used',
  'story_started', 'story_told', 'story_finished', 'story_graded', 'about_me_finished',
  'prep_plan_set', 'transcript_added', 'practice_started', 'practice_answered',
  'tough_question_started', 'about_me_tailored', 'questions_to_ask_made', 'resume_bullets_made',
  'brief_opened', 'warm_up_opened', 'profile_opened', 'questions_shared',
  'screen_practice_started', 'tough_drill_started', 'curriculum_made', 'job_finished'
));
