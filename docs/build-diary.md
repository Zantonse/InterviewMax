# InterviewMax build diary

What shipped, what Craig decided, and what feedback changed direction. Newest day first. Dates are UTC. PR links go to github.com/Zantonse/InterviewMax.

**Keeping it current:** this is a copy of the build diary kept in the project's shared files, taken on 2026-10-14. The shared copy is updated as each PR merges; this one is refreshed with docs updates.

---

## 2026-10-14

**Shipped**
- [#31](https://github.com/Zantonse/InterviewMax/pull/31) Add a target job from its own page: a link, an upload or typed text is each enough on its own.
- [#30](https://github.com/Zantonse/InterviewMax/pull/30) Left navy sidebar on every signed-in page (Build a story, Your prep, Target jobs, Past interviews, Your numbers, recent stories). Collapsible, drawer on phone. Replaces #26.
- [#29](https://github.com/Zantonse/InterviewMax/pull/29) Fill in a target job from a saved web page or screenshots (user checks the lines read from images).
- [#27](https://github.com/Zantonse/InterviewMax/pull/27) Fill in a target job from a posting saved as PDF.
- [#26](https://github.com/Zantonse/InterviewMax/pull/26) Header links to Target jobs and Past interviews, after Craig couldn't find the transcripts page on his phone.
- [#25](https://github.com/Zantonse/InterviewMax/pull/25) Numbers checklist: per role, the numbers a story needs and where to find them; the story builder uses them. Needs `numbers-checklist/run-in-supabase.sql` run in Supabase.
- [#24](https://github.com/Zantonse/InterviewMax/pull/24) Coverage grid in the Story bank: which question themes your stories cover, with empty themes starting the missing story, plus level mix.
- [#23](https://github.com/Zantonse/InterviewMax/pull/23) Work emails can sign in when a mail scanner opens the link first (confirm button page plus a 6-digit code). Craig pasted the new email templates; okta.com sign-in works.
- [#22](https://github.com/Zantonse/InterviewMax/pull/22) Navy and amber brand, green for status, branded sign-in emails.

**Decided**
- "Do 1 and 2": build the numbers checklist and coverage grid next (both shipped same day).
- Resume enhancer added to the PRD as P1: story-bank bullets using only traced numbers, tailored per job. No full resume builder. Not yet approved to build.
- PRD P2: intake assessment and paywall (About me free, rest premium). Free users see the top 3 likely questions for one job, the rest blurred. Price model still open (planning suggests a job-search pass over a subscription).
- PRD P2: success stories and ratings on the front page. Opt-in, Craig approves each, real submissions only.
- Competitors section added to the PRD (Exponent, Big Interview, Final Round AI, Day One Careers and others).
- Data privacy and AI usage added to the PRD only, as a requirement before real users (data inventory, delete account and data, own Supabase project, no-training model providers). No standalone policy drafts.
- Started this build diary.

**Open**
- [#28](https://github.com/Zantonse/InterviewMax/pull/28) Keep a story marked "Draft written" while "Ask me more" makes it stronger.
- P0 left to build: mic mode, and the evaluation harness (waiting on about 10 hand-graded stories from Craig).

---

## 2026-10-13

**Shipped**
- [#21](https://github.com/Zantonse/InterviewMax/pull/21) Story page split into "1 · Build" and "2 · Story & score" tabs.
- [#19](https://github.com/Zantonse/InterviewMax/pull/19) Compact top of the home page so stories show sooner.
- [#20](https://github.com/Zantonse/InterviewMax/pull/20) Grading checks each story's content against your target jobs (fit, what it proves, what it misses, level match).
- [#12](https://github.com/Zantonse/InterviewMax/pull/12) Evaluation gets its own right-hand column with a summary, "What's working" and "To raise it", after Craig found it thin.
- [#17](https://github.com/Zantonse/InterviewMax/pull/17) Value first: paste a job, see likely questions right away, set up the rest later. About me no longer locks other stories. Fixed LinkedIn prefill filling only 2 of 8 answers.
- [#18](https://github.com/Zantonse/InterviewMax/pull/18) About me per target job, company first (why this company, one proof point, three beats); gentler autobiographer follow-ups; length caps and a check that flags hedged figures like "maybe 100".
- [#15](https://github.com/Zantonse/InterviewMax/pull/15) Past interview transcripts (/transcripts) feed likely questions and story follow-ups.
- [#16](https://github.com/Zantonse/InterviewMax/pull/16) Delete a story to start it over.
- [#14](https://github.com/Zantonse/InterviewMax/pull/14) Fill in a target job from a link to its posting (LinkedIn, Indeed and Glassdoor block this, so the form says to paste instead).
- [#13](https://github.com/Zantonse/InterviewMax/pull/13) and [#7](https://github.com/Zantonse/InterviewMax/pull/7) "Why InterviewMax" problem statement on home and sign-in, moved to the top.
- [#11](https://github.com/Zantonse/InterviewMax/pull/11) Target jobs and likely questions per job.
- [#9](https://github.com/Zantonse/InterviewMax/pull/9) Grade each story and show its evaluation criteria.
- [#10](https://github.com/Zantonse/InterviewMax/pull/10) "Map my role" at the start of About me.
- [#8](https://github.com/Zantonse/InterviewMax/pull/8) Push harder for numbers and specifics ("make it stronger"), and show the story as a spoken script.
- [#6](https://github.com/Zantonse/InterviewMax/pull/6) Fill in "Tell me about yourself" from a LinkedIn profile PDF.
- [#5](https://github.com/Zantonse/InterviewMax/pull/5) "Tell me about yourself" as the required first story, with Word upload (gate later removed by #17).
- [#4](https://github.com/Zantonse/InterviewMax/pull/4) Home page stays up when stories can't load (prod 500'd because the Supabase tables hadn't been created yet; Craig ran the setup SQL).
- [#2](https://github.com/Zantonse/InterviewMax/pull/2) Story builder.
- [#1](https://github.com/Zantonse/InterviewMax/pull/1) Foundation: Next.js, Supabase magic-link sign-in, model layer, CI. Live on Vercel at interview-max-mauve.vercel.app; Craig signed in.

**Decided**
- Run all model steps through OpenRouter for now; keep Claude Opus 5.5 for the story calls, to revisit with the eval harness.
- Craig's brother (a target user who did one slice of data governance and couldn't describe his role): approved "Map my role" for About me.
- Approved all 5 changes from Victor's test (below).
- PRD v0.3 written as a new doc next to the original v0.2 PDF, with changes tagged [v0.3].

**Feedback that changed direction**
- **Victor's test.** He dropped off from setup friction before seeing value, found follow-ups too intense ("your 2 or 3 career moves" as a first ask), wanted About me tailored to the company, found the output long and fluffy, and praised the likely questions. Led to: value first onboarding (#17), company-first About me, autobiographer tone and fluff cuts (#18). The fifth change is Craig shadowing Kevin through one timed flow (not done yet).
- **Craig on the evaluation:** too thin. Led to #12 and the content checks in #20.

---

## 2026-10-12

**Decided**
- Project started. Build plan drafted from the PRD (v0.2); the repo was empty.
- Model calls go through a thin layer of our own that supports OpenRouter, plus direct Claude and OpenAI APIs so Craig's credits get used. Each step names its provider and model in one config file.
- Foundation first. Stack: Next.js + Supabase + Vercel.
- The PRD's manual runs with Andrew and Kevin haven't happened; building goes ahead in parallel.
- Craig said go on the foundation; its PR (#1) opened the same day.
