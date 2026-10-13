-- Likely questions (roadmap item 6): the predicted questions for each target job, and the public
-- interview reports the user pasted for it. Safe to run more than once.
alter table public.target_jobs add column if not exists likely_questions jsonb;
alter table public.target_jobs add column if not exists interview_reports text;
