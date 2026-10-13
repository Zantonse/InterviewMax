-- Past interview transcripts: what the user uploaded or pasted, optionally linked to a target job,
-- and the review of it (see src/lib/transcripts/content.ts). Private to the owner like every
-- other table. Safe to run more than once.
create table if not exists public.interview_transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_job_id uuid references public.target_jobs (id) on delete set null,
  title text not null,
  company text,
  -- How the user is labelled in the transcript ("Me", "Speaker 2", their name), when they said.
  speaker text,
  file_name text,
  transcript text not null,
  analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists interview_transcripts_user_id_idx on public.interview_transcripts (user_id);
create index if not exists interview_transcripts_target_job_id_idx
  on public.interview_transcripts (target_job_id);

drop trigger if exists interview_transcripts_set_updated_at on public.interview_transcripts;
create trigger interview_transcripts_set_updated_at before update on public.interview_transcripts
  for each row execute function public.set_updated_at();

alter table public.interview_transcripts enable row level security;

drop policy if exists "Transcripts: owner can read" on public.interview_transcripts;
create policy "Transcripts: owner can read" on public.interview_transcripts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Transcripts: owner can insert" on public.interview_transcripts;
create policy "Transcripts: owner can insert" on public.interview_transcripts
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (
      target_job_id is null
      or exists (
        select 1 from public.target_jobs j
        where j.id = target_job_id and j.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Transcripts: owner can update" on public.interview_transcripts;
create policy "Transcripts: owner can update" on public.interview_transcripts
  for update to authenticated using ((select auth.uid()) = user_id) with check (
    (select auth.uid()) = user_id
    and (
      target_job_id is null
      or exists (
        select 1 from public.target_jobs j
        where j.id = target_job_id and j.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Transcripts: owner can delete" on public.interview_transcripts;
create policy "Transcripts: owner can delete" on public.interview_transcripts
  for delete to authenticated using ((select auth.uid()) = user_id);
