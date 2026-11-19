-- Prep for each interview stage (Nov 11): the stage of a job's next interview (recruiter screen,
-- hiring manager, panel, final, another round), so the brief, warm-up and practice put what that
-- stage asks first. Null means not set; the app then uses the interview timeline's guess. On the
-- job's row, which row-level security already limits to its owner. Safe to run more than once.

alter table public.target_jobs add column if not exists next_stage text;
alter table public.target_jobs drop constraint if exists target_jobs_next_stage_check;
alter table public.target_jobs add constraint target_jobs_next_stage_check
  check (next_stage is null or next_stage in ('recruiter', 'hiring_manager', 'panel', 'final', 'other'));
