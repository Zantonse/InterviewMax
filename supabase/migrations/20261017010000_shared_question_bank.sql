-- Shared question bank (PRD v0.3, P1). A user can share the questions they were asked in a past
-- interview (never their answers): when they opt in on a transcript, its behavioral questions are
-- copied here with names removed, tagged with company, role, level, round and month, and wait
-- for Craig's approval in the admin panel. Approved questions show other users with a job at the
-- same company as "asked recently", through recent_shared_questions(), which returns the question
-- and its tags only, never who shared it. Withdrawing deletes the rows; so does deleting the
-- transcript or the account. Safe to run more than once.

alter table public.interview_transcripts
  add column if not exists share_questions boolean not null default false,
  add column if not exists interview_round text,
  -- Questions the user chose not to share from this transcript (lower-cased keys).
  add column if not exists share_excluded text[] not null default '{}';

create table if not exists public.shared_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default public.current_user_id()
    references public.profiles (id) on delete cascade,
  transcript_id uuid not null references public.interview_transcripts (id) on delete cascade,
  -- The question as shared (names removed), and the key of the question it came from.
  question text not null check (char_length(question) between 1 and 300),
  source_key text not null,
  theme text,
  company text check (char_length(company) <= 200),
  role text check (char_length(role) <= 200),
  level text,
  round text,
  asked_month date not null,
  -- What the code check found (a number, a possible name), for the reviewer.
  flags text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists shared_questions_user_id_idx on public.shared_questions (user_id);
create index if not exists shared_questions_transcript_id_idx on public.shared_questions (transcript_id);
create index if not exists shared_questions_company_idx
  on public.shared_questions (lower(company), asked_month desc) where status = 'approved';
create index if not exists shared_questions_pending_idx
  on public.shared_questions (created_at) where status = 'pending';

alter table public.shared_questions enable row level security;

-- Owners see, add and withdraw their own. Only the admin panel (secret key) approves or rejects.
drop policy if exists "Shared questions: owner can read" on public.shared_questions;
create policy "Shared questions: owner can read" on public.shared_questions
  for select to authenticated using ((select public.current_user_id()) = user_id);

drop policy if exists "Shared questions: owner can insert" on public.shared_questions;
create policy "Shared questions: owner can insert" on public.shared_questions
  for insert to authenticated with check (
    (select public.current_user_id()) = user_id
    and status = 'pending'
    and reviewed_at is null
    and exists (
      select 1 from public.interview_transcripts t
      where t.id = transcript_id and t.user_id = (select public.current_user_id())
    )
  );

drop policy if exists "Shared questions: owner can delete" on public.shared_questions;
create policy "Shared questions: owner can delete" on public.shared_questions
  for delete to authenticated using ((select public.current_user_id()) = user_id);

-- Approved questions from the last six months at one company, from other people only. Returns no
-- user or transcript ids.
create or replace function public.recent_shared_questions(p_company text)
returns table (
  question text, theme text, company text, role text, level text, round text, asked_month date
)
language sql stable security definer set search_path = public
as $$
  select q.question, q.theme, q.company, q.role, q.level, q.round, q.asked_month
  from public.shared_questions q
  where q.status = 'approved'
    and lower(trim(q.company)) = lower(trim(p_company))
    and q.asked_month >= (date_trunc('month', now()) - interval '6 months')::date
    and q.user_id is distinct from public.current_user_id()
  order by q.asked_month desc, q.created_at desc
  limit 30;
$$;
revoke all on function public.recent_shared_questions(text) from public, anon;
grant execute on function public.recent_shared_questions(text) to authenticated;

-- The new usage event: that someone shared questions, never which.
alter table public.usage_events drop constraint if exists usage_events_event_check;
alter table public.usage_events add constraint usage_events_event_check check (event in (
  'sign_up', 'assessment_done', 'job_added', 'likely_questions_shown', 'story_finder_used',
  'story_started', 'story_finished', 'story_graded', 'about_me_finished', 'prep_plan_set',
  'transcript_added', 'practice_started', 'practice_answered', 'tough_question_started',
  'about_me_tailored', 'questions_to_ask_made', 'resume_bullets_made', 'brief_opened',
  'warm_up_opened', 'profile_opened', 'questions_shared'
));
