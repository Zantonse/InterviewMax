-- Coaching guidelines: Craig's session patterns (2026-11-19), from a recorded mock-interview
-- session he ran with two friends. Content only, no schema change. Safe to run more than once.
--
-- Adds a "Running a session" checklist as the second section, and updates the three starter
-- sections it touches ("How I coach", "Story review checklist", "After a session"). A section
-- Craig has already edited in the admin panel (updated_by set) is left exactly as he wrote it.
-- Craig's full coaching profile: /mnt/project-files/coaching/craig-coaching-profile.md.

do $migration$
begin
  if not exists (select 1 from public.coaching_guidelines where title = 'Running a session') then
    update public.coaching_guidelines set position = position + 1 where position >= 2;
    insert into public.coaching_guidelines (title, body, position)
    values ('Running a session', $$Same shape every time, so they know what's coming. Short cycles beat a perfect draft: three or four passes, and every pass gets shorter.

- [ ] Set it up before anyone answers: today's goal, 90 seconds an answer, and the one framework we use (CARL, opened by their principle)
- [ ] They answer out loud, timed
- [ ] Headline check: after the first two sentences, could I say what the story is about and how it turned out?
- [ ] Two or three feedback points, most important first: what worked, then what to fix
- [ ] One minute to rework it, then answer again out loud. It's fine to mess up
- [ ] Probe the weak spot: why was it a problem, what did you do, who was involved
- [ ] Repeat, three or four passes at most
- [ ] With a peer in the room, they give feedback the same way: two or three points, "I" not "we", name who was involved
- [ ] Close with next steps (see After a session) before any small talk$$, 2);
  end if;
end
$migration$;

update public.coaching_guidelines
set updated_at = now(), body = $$The story is theirs. My job is to help them find it, tell it and believe it.

- Their own words first. Edit what they said; never write a story for them. If a draft no longer sounds like them, it won't hold up in the room.
- Headline first, then the details. The answer in one sentence, then how it happened, so nobody has to piece it together at the end. ("I baked my son's second birthday cake", then the trips to the store, not the other way round.)
- Show your thinking. At the key decision, ask what they weighed, what they chose and why. That's what separates a senior answer from a list of tasks.
- Two or three points a round. Say what's working and the two or three things that matter most; the rest waits for the next pass.
- Find the real number. When they don't remember it, help them dig it up or reach an honest estimate said as one ("about 20%", "roughly 3 weeks"). Never make a figure up, or ask an AI to invent the business benefit: the interviewer's follow-up will find it.
- "I", not "we". Credit the team and name who was involved so the interviewer can picture them, then be clear about what they did.
- Ask, don't tell. Keep asking "why was that a problem?" and "what did you do?" until the real problem and their own actions come out.
- Tasks are skills. "I showed them the config" is enablement; getting their manager on board is working with leadership; checking it kept working is follow-through. Name the skill.
- Deeper, not bigger. One more follow-up on the hardest part beats a second story.
- Tone can change, the bar can't. Gentle, direct or tough love changes how I say it, never what I flag.$$
where title = 'How I coach' and updated_by is null;

update public.coaching_guidelines
set updated_at = now(), body = $$- [ ] Opens with a headline: what happened and how it turned out, in the first two sentences
- [ ] Context in two sentences or fewer
- [ ] Their own role is clear ("I", not "we"), and the people involved are named
- [ ] A real decision, with what they weighed and why (show your thinking)
- [ ] What they did is named as a skill (enablement, leadership, follow-through), not a list of steps
- [ ] At least one real number, or an honest estimate said as one
- [ ] A result, and what they'd do differently or learned
- [ ] Pitched at the level of the job
- [ ] Fits in about 90 seconds out loud$$
where title = 'Story review checklist' and updated_by is null;

update public.coaching_guidelines
set updated_at = now(), body = $$- [ ] Before we hang up, each person says which story they'll rewrite and by when
- [ ] Write down one to three next actions, in their words
- [ ] Note which stories to rework and which to practice
- [ ] Set the next check-in before their interview date$$
where title = 'After a session' and updated_by is null;
