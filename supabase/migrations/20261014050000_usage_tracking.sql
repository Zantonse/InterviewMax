-- Usage tracking and admin panel (PRD v0.3). Events are a user id, an event name and a time: never
-- story text, numbers or uploads. Only the server writes them and only the admin panel reads them,
-- both with the secret key, so there are no row-level security policies: with the publishable key
-- nobody can read or forge events. Safe to run more than once.

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event text not null,
  -- True for events worked out from data saved before tracking started; their times are close,
  -- not exact.
  estimated boolean not null default false,
  created_at timestamptz not null default now()
);
-- Keep in step with USAGE_EVENTS in src/lib/usage/events.ts.
alter table public.usage_events drop constraint if exists usage_events_event_check;
alter table public.usage_events add constraint usage_events_event_check check (event in (
  'sign_up', 'assessment_done', 'job_added', 'likely_questions_shown', 'story_finder_used',
  'story_started', 'story_finished', 'story_graded', 'about_me_finished', 'prep_plan_set'
));
create index if not exists usage_events_user_id_created_at_idx
  on public.usage_events (user_id, created_at);
alter table public.usage_events enable row level security;

-- Every time the admin panel is opened: who looked, at which page, and at which user if one.
-- Kept when a user is deleted (no foreign key), so the record of who looked survives.
create table if not exists public.admin_views (
  id bigint generated always as identity primary key,
  admin_email text not null,
  view text not null,
  subject_user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists admin_views_created_at_idx on public.admin_views (created_at desc);
alter table public.admin_views enable row level security;

-- Belt and braces: no table privileges for browser roles either.
revoke all on table public.usage_events from anon, authenticated;
revoke all on table public.admin_views from anon, authenticated;

-- Sign-up is recorded when the profile is made, however the person signed in.
create or replace function public.track_sign_up()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usage_events (user_id, event, created_at) values (new.id, 'sign_up', new.created_at);
  return new;
end;
$$;
revoke all on function public.track_sign_up() from public, anon, authenticated;

drop trigger if exists profiles_track_sign_up on public.profiles;
create trigger profiles_track_sign_up
  after insert on public.profiles
  for each row execute function public.track_sign_up();

-- Backfill, once: events for what users did before tracking started, so the funnel and the
-- time-to-value numbers include the first testers. Times come from when rows were saved, so all
-- but sign-up are marked estimated. Reads stories.content only to see whether a draft or grade
-- exists, and their timestamps; nothing is copied out.
do $$
declare
  ts_re constant text := '^\d{4}-\d{2}-\d{2}T';
begin
  -- Profiles added for early users after the fact are newer than the account, so take the earlier.
  insert into public.usage_events (user_id, event, created_at)
  select p.id, 'sign_up', least(p.created_at, u.created_at)
  from public.profiles p
  left join auth.users u on u.id = p.id
  where not exists (
    select 1 from public.usage_events e where e.user_id = p.id and e.event = 'sign_up'
  );

  -- Any other event means the backfill already ran, or tracking has started; don't double up.
  if exists (select 1 from public.usage_events where event <> 'sign_up') then
    return;
  end if;

  insert into public.usage_events (user_id, event, created_at, estimated)
  select j.user_id, 'job_added', j.created_at, true from public.target_jobs j
  where exists (select 1 from public.profiles p where p.id = j.user_id);

  insert into public.usage_events (user_id, event, created_at, estimated)
  select j.user_id, 'likely_questions_shown', (j.likely_questions ->> 'generatedAt')::timestamptz, true
  from public.target_jobs j
  where j.likely_questions ->> 'generatedAt' ~ ts_re
    and exists (select 1 from public.profiles p where p.id = j.user_id);

  insert into public.usage_events (user_id, event, created_at, estimated)
  select j.user_id, 'prep_plan_set', j.updated_at, true from public.target_jobs j
  where j.interview_date is not null
    and exists (select 1 from public.profiles p where p.id = j.user_id);

  insert into public.usage_events (user_id, event, created_at, estimated)
  select s.user_id, 'story_started', s.created_at, true from public.stories s
  where exists (select 1 from public.profiles p where p.id = s.user_id);

  insert into public.usage_events (user_id, event, created_at, estimated)
  select s.user_id, x.event,
    case when s.content -> 'draft' ->> 'writtenAt' ~ ts_re
      then (s.content -> 'draft' ->> 'writtenAt')::timestamptz else s.updated_at end,
    true
  from public.stories s
  cross join lateral (
    select 'story_finished' as event
    union all
    select 'about_me_finished' where s.story_type = 'about_me'
  ) x
  where jsonb_typeof(s.content -> 'draft') = 'object'
    and exists (select 1 from public.profiles p where p.id = s.user_id);

  insert into public.usage_events (user_id, event, created_at, estimated)
  select s.user_id, 'story_graded',
    case when s.content -> 'grade' ->> 'gradedAt' ~ ts_re
      then (s.content -> 'grade' ->> 'gradedAt')::timestamptz else s.updated_at end,
    true
  from public.stories s
  where jsonb_typeof(s.content -> 'grade') = 'object'
    and exists (select 1 from public.profiles p where p.id = s.user_id);

  insert into public.usage_events (user_id, event, created_at, estimated)
  select p.id, 'assessment_done', (p.intake_assessment ->> 'completedAt')::timestamptz, true
  from public.profiles p
  where p.intake_assessment ->> 'completedAt' ~ ts_re;

  insert into public.usage_events (user_id, event, created_at, estimated)
  select p.id, 'story_finder_used', (p.story_finder ->> 'foundAt')::timestamptz, true
  from public.profiles p
  where p.story_finder ->> 'foundAt' ~ ts_re;
end;
$$;

-- One row per user with counts only, for the admin panel. Looks inside stories.content only to
-- test whether a draft or grade exists; returns no text. Callable with the secret key only.
create or replace function public.admin_user_progress()
returns table (
  user_id uuid,
  email text,
  signed_up_at timestamptz,
  last_active_at timestamptz,
  jobs int,
  jobs_with_questions int,
  interview_dates int,
  stories_started int,
  stories_finished int,
  stories_graded int,
  about_me_done boolean,
  assessment_done boolean,
  finder_used boolean,
  transcripts int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.email,
    coalesce(e.signed_up_at, p.created_at),
    greatest(p.updated_at, j.last_at, s.last_at, t.last_at, e.last_at),
    coalesce(j.total, 0),
    coalesce(j.with_questions, 0),
    coalesce(j.with_date, 0),
    coalesce(s.total, 0),
    coalesce(s.finished, 0),
    coalesce(s.graded, 0),
    coalesce(s.about_me, false),
    coalesce(p.intake_assessment ? 'completedAt', false),
    coalesce(jsonb_typeof(p.story_finder -> 'moments') = 'array', false),
    coalesce(t.total, 0)
  from public.profiles p
  left join lateral (
    select count(*)::int as total,
      count(*) filter (where jsonb_typeof(x.likely_questions) = 'object')::int as with_questions,
      count(*) filter (where x.interview_date is not null)::int as with_date,
      max(x.updated_at) as last_at
    from public.target_jobs x where x.user_id = p.id
  ) j on true
  left join lateral (
    select count(*)::int as total,
      count(*) filter (where jsonb_typeof(x.content -> 'draft') = 'object')::int as finished,
      count(*) filter (where jsonb_typeof(x.content -> 'grade') = 'object')::int as graded,
      bool_or(x.story_type = 'about_me' and jsonb_typeof(x.content -> 'draft') = 'object') as about_me,
      max(x.updated_at) as last_at
    from public.stories x where x.user_id = p.id
  ) s on true
  left join lateral (
    select count(*)::int as total, max(x.updated_at) as last_at
    from public.interview_transcripts x where x.user_id = p.id
  ) t on true
  left join lateral (
    select max(x.created_at) as last_at,
      min(x.created_at) filter (where x.event = 'sign_up') as signed_up_at
    from public.usage_events x where x.user_id = p.id
  ) e on true
  order by p.created_at desc
$$;

-- When each user first did each thing, and how many times. Feeds the funnel and time-to-value.
create or replace function public.admin_event_firsts()
returns table (user_id uuid, event text, first_at timestamptz, times int, estimated boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (e.user_id, e.event)
    e.user_id, e.event, e.created_at,
    (count(*) over (partition by e.user_id, e.event))::int,
    e.estimated
  from public.usage_events e
  order by e.user_id, e.event, e.created_at
$$;

revoke all on function public.admin_user_progress() from public, anon, authenticated;
revoke all on function public.admin_event_firsts() from public, anon, authenticated;
grant execute on function public.admin_user_progress() to service_role;
grant execute on function public.admin_event_firsts() to service_role;
