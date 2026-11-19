-- 1:1 coaching, part 1 (Craig, 2026-11-19): the coach sends a person a one-time invite link, the
-- person says yes on a consent screen, and from then on the coach has a page for them (jobs,
-- interview dates, stories by level, practice, interview profile). Invite only; Craig is the only
-- coach (ADMIN_EMAILS). The person can stop coaching from Settings at any time.
-- Safe to run more than once.

-- Invites. Admin-only: row-level security is on with no policies, so only the admin panel's
-- secret-key client reads or writes them. Only a SHA-256 hash of the link's code is kept, so the
-- link itself can't be read back out of the database.
create table if not exists public.coach_invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  -- Who the coach meant it for ("Kevin"), shown only in the coach's own list.
  label text not null default '' check (char_length(label) <= 80),
  created_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz
);

alter table public.coach_invites enable row level security;
revoke all on public.coach_invites from anon, authenticated;

-- Who is being coached. One row per person (the user_id is the key); stopping keeps the row with
-- stopped_at set, so a later invite can start it again. The person can read their own row; every
-- change goes through accept_coach_invite() and stop_coaching() below.
create table if not exists public.coaching_clients (
  user_id uuid primary key default public.current_user_id()
    references public.profiles (id) on delete cascade,
  coach_email text not null,
  invite_id uuid references public.coach_invites (id) on delete set null,
  started_at timestamptz not null default now(),
  stopped_at timestamptz
);

alter table public.coaching_clients enable row level security;
revoke all on public.coaching_clients from anon, authenticated;
grant select on public.coaching_clients to authenticated;

drop policy if exists "coaching_clients: read own" on public.coaching_clients;
create policy "coaching_clients: read own" on public.coaching_clients
  for select to authenticated using (user_id = public.current_user_id());

-- Says yes to an invite for the signed-in person. Returns 'ok', 'invalid', 'used', 'expired' or
-- 'revoked'. The invite's code is checked by its hash, and each invite works once.
create or replace function public.accept_coach_invite(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.current_user_id();
  v_invite public.coach_invites%rowtype;
begin
  if v_user is null then
    return 'invalid';
  end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{20,64}$' then
    return 'invalid';
  end if;

  select * into v_invite
  from public.coach_invites
  where code_hash = encode(sha256(convert_to(p_code, 'UTF8')), 'hex')
  for update;

  if not found then
    return 'invalid';
  end if;
  if v_invite.revoked_at is not null then
    return 'revoked';
  end if;
  if v_invite.used_at is not null then
    -- Opening their own link again while coaching is on is fine; after stopping, it takes a new one.
    if v_invite.used_by = v_user and exists (
      select 1 from public.coaching_clients c
      where c.user_id = v_user and c.invite_id = v_invite.id and c.stopped_at is null
    ) then
      return 'ok';
    end if;
    return 'used';
  end if;
  if v_invite.expires_at < now() then
    return 'expired';
  end if;

  update public.coach_invites set used_at = now(), used_by = v_user where id = v_invite.id;

  insert into public.coaching_clients (user_id, coach_email, invite_id, started_at, stopped_at)
  values (v_user, v_invite.created_by, v_invite.id, now(), null)
  on conflict (user_id) do update
    set coach_email = excluded.coach_email,
        invite_id = excluded.invite_id,
        started_at = excluded.started_at,
        stopped_at = null;

  insert into public.usage_events (user_id, event) values (v_user, 'coaching_started');
  return 'ok';
end;
$$;

revoke all on function public.accept_coach_invite(text) from public, anon;
grant execute on function public.accept_coach_invite(text) to authenticated;

-- Whether an invite could be accepted, without accepting it: the consent screen asks first, so a
-- dead link says why before anyone reads the consent text. Same answers as accept_coach_invite().
create or replace function public.coach_invite_status(p_code text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.current_user_id();
  v_invite public.coach_invites%rowtype;
begin
  if v_user is null or p_code is null or p_code !~ '^[A-Za-z0-9_-]{20,64}$' then
    return 'invalid';
  end if;
  select * into v_invite
  from public.coach_invites
  where code_hash = encode(sha256(convert_to(p_code, 'UTF8')), 'hex');
  if not found then
    return 'invalid';
  end if;
  if v_invite.revoked_at is not null then
    return 'revoked';
  end if;
  if v_invite.used_at is not null then
    if v_invite.used_by = v_user and exists (
      select 1 from public.coaching_clients c
      where c.user_id = v_user and c.invite_id = v_invite.id and c.stopped_at is null
    ) then
      return 'ok';
    end if;
    return 'used';
  end if;
  if v_invite.expires_at < now() then
    return 'expired';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.coach_invite_status(text) from public, anon;
grant execute on function public.coach_invite_status(text) to authenticated;

-- Stops coaching for the signed-in person. From then on the coach's client page for them is
-- closed. Returns true if coaching was on.
create or replace function public.stop_coaching()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.current_user_id();
begin
  if v_user is null then
    return false;
  end if;
  update public.coaching_clients
  set stopped_at = now()
  where user_id = v_user and stopped_at is null;
  if not found then
    return false;
  end if;
  insert into public.usage_events (user_id, event) values (v_user, 'coaching_stopped');
  return true;
end;
$$;

revoke all on function public.stop_coaching() from public, anon;
grant execute on function public.stop_coaching() to authenticated;

-- The two new usage events.
alter table public.usage_events drop constraint if exists usage_events_event_check;
alter table public.usage_events add constraint usage_events_event_check check (event in (
  'sign_up', 'assessment_done', 'job_added', 'likely_questions_shown', 'story_finder_used',
  'story_started', 'story_told', 'story_finished', 'story_graded', 'about_me_finished',
  'prep_plan_set', 'transcript_added', 'practice_started', 'practice_answered',
  'tough_question_started', 'about_me_tailored', 'questions_to_ask_made', 'resume_bullets_made',
  'brief_opened', 'warm_up_opened', 'profile_opened', 'questions_shared',
  'screen_practice_started', 'tough_drill_started', 'curriculum_made', 'job_finished',
  'ai_answer_for_job', 'job_role_added', 'story_level_2', 'story_level_3',
  'coaching_started', 'coaching_stopped'
));
