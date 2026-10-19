-- Coaching (PRD v0.3, P2). Two pieces, both safe to run more than once:
--
-- 1. Coaching style: how the coach talks to the user (gentle, direct, tough love), picked in
--    Settings and kept on the profile row, which row-level security already limits to its owner.
--    Empty means the default, balanced. Tone only; see src/lib/coaching/style.ts.
--
-- 2. Coaching guidelines: Craig's own coaching principles and checklists, edited in the admin panel
--    (/admin/guidelines). Not user data, so no user_id. Row-level security is on with no policies:
--    only the admin panel's secret-key client can read or change it. Seeded once with a starter
--    outline drawn from the app's principles.

alter table public.profiles add column if not exists coaching_style text;
alter table public.profiles drop constraint if exists profiles_coaching_style_check;
alter table public.profiles add constraint profiles_coaching_style_check
  check (coaching_style in ('gentle', 'direct', 'tough_love'));

create table if not exists public.coaching_guidelines (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 20000),
  position integer not null default 0,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coaching_guidelines enable row level security;
revoke all on public.coaching_guidelines from anon, authenticated;

insert into public.coaching_guidelines (title, body, position)
select v.title, v.body, v.position
from (values
  ('How I coach', $$The story is theirs. My job is to help them find it, tell it and believe it.

- Their own words first. Edit what they said; never write a story for them. If a draft no longer sounds like them, it won't hold up in the room.
- Show your thinking. At the key decision, ask what they weighed, what they chose and why. That's what separates a senior answer from a list of tasks.
- Feedback, not scores. Say what's working and the one thing to fix next. Numbers on a story wait until the eval harness shows they're fair.
- An estimate beats a blank. When they don't remember the number, help them reach an honest estimate and say so ("about 20%", "roughly 3 weeks"). Never make a figure up.
- "I", not "we". Credit the team, then be clear about what they did.
- Deeper, not bigger. One more follow-up on the hardest part beats a second story.
- Tone can change, the bar can't. Gentle, direct or tough love changes how I say it, never what I flag.$$, 1),
  ('Before a session', $$- [ ] Read their target jobs, levels and interview dates
- [ ] Read their finished stories (opening one from the admin panel is logged)
- [ ] Check their interviewee profile and which themes have no story yet
- [ ] Look at their past interviews for questions they struggled with
- [ ] Pick the two or three stories that matter most for the next interview
- [ ] Write one question to ask about each$$, 2),
  ('Story review checklist', $$- [ ] Context in two sentences or fewer
- [ ] Their own role is clear ("I", not "we")
- [ ] A real decision, with what they weighed and why (show your thinking)
- [ ] At least one number, or an honest estimate said as one
- [ ] A result, and what they'd do differently or learned
- [ ] Pitched at the level of the job
- [ ] Fits in about two minutes out loud$$, 3),
  ('After a session', $$- [ ] Write down one to three next actions, in their words
- [ ] Note which stories to rework and which to practice
- [ ] Set the next check-in before their interview date$$, 4)
) as v(title, body, position)
where not exists (select 1 from public.coaching_guidelines);
