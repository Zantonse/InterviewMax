-- Entry level (Oct 31): target jobs can be set to "entry" as well as mid, senior and principal.
-- Safe to run more than once.
alter table public.target_jobs drop constraint if exists target_jobs_level_check;
alter table public.target_jobs add constraint target_jobs_level_check
  check (level is null or level in ('entry', 'mid', 'senior', 'principal'));
