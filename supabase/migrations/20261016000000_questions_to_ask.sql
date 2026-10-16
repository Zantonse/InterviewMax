-- Questions to ask the interviewer (PRD v0.3, P1): the suggested, saved and user-written questions
-- for each target job (see src/lib/ask/content.ts). Safe to run more than once.
alter table public.target_jobs add column if not exists questions_to_ask jsonb;
