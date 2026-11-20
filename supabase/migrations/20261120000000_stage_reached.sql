-- Job map (Nov 20): the stage a finished job's interviews ended at (applied with no interview,
-- recruiter screen, hiring manager, panel, final), so the job map can place each job on the
-- pipeline and spot where interviews tend to stop. Null means not set yet; offers leave it null,
-- since an offer got past every stage. On the job's row, which row-level security already limits to
-- its owner. Safe to run more than once.

alter table public.target_jobs add column if not exists stage_reached text;
alter table public.target_jobs drop constraint if exists target_jobs_stage_reached_check;
alter table public.target_jobs add constraint target_jobs_stage_reached_check
  check (stage_reached is null or stage_reached in ('applied', 'recruiter', 'hiring_manager', 'panel', 'final'));
