-- Resume enhancer (PRD v0.3, P1): resume bullets written from the user's finished stories for each
-- target job, plus a two-line summary (see src/lib/resume/content.ts). Safe to run more than once.
alter table public.target_jobs add column if not exists resume_bullets jsonb;
