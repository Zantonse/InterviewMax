-- Time-boxed prep plan (PRD v0.3): the date of the user's next interview for each target job, which
-- sizes the plan on the home page (see src/lib/prep/plan.ts). Safe to run more than once.
alter table public.target_jobs add column if not exists interview_date date;
