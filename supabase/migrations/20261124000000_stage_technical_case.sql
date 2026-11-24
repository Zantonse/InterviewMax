-- Two more interview stages (Nov 24, from Craig's data governance interview doc): "technical"
-- (a technical or skills round) and "case" (a case or design round), between the hiring manager
-- and the panel. Widens the next-stage check to allow them. Safe to run more than once.

alter table public.target_jobs drop constraint if exists target_jobs_next_stage_check;
alter table public.target_jobs add constraint target_jobs_next_stage_check
  check (
    next_stage is null
    or next_stage in ('recruiter', 'hiring_manager', 'technical', 'case', 'panel', 'final', 'other')
  );
