# InterviewMax

A guided path that turns an experienced candidate's own work history into metric-backed behavioral interview stories aimed at the jobs they're targeting.

Live: [interview-max-mauve.vercel.app](https://interview-max-mauve.vercel.app). Product spec: [PRD v0.3](https://claude.ai/code/artifact/3178b97a-ea69-472a-b407-c4f511895d27). What shipped and why: [docs/build-diary.md](docs/build-diary.md).

Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres, email sign-in, row-level security), Vercel, Vitest and Playwright. Model calls go through our own thin layer over OpenRouter, the Claude API and the OpenAI API.

## What it does

- **Sign in** with a magic link or a 6-digit code from the same email. The link opens a "One more click" page first, so a work email's link scanner can't use it up. With `AUTH_PROVIDER=auth0`, Auth0 signs people in instead (Google, LinkedIn or an emailed code) and Supabase keeps the data; existing users are matched by verified email on their first Auth0 sign-in and keep their stories.
- **Value first.** Paste a job posting and see its likely behavioral questions straight away; the rest of the setup can wait.
- **Target jobs** (`/jobs`). Add a job from a link to its posting, a PDF, a saved web page (.html/.mhtml), screenshots, or typed text; any one is enough. LinkedIn, Indeed and Glassdoor block link fetching, so the form asks for a paste there. Each job gets its role level, likely questions (themed, informed by interview reports you paste), and a read of how it compares with your resume and other jobs.
- **Tell me about yourself.** Filled in from a LinkedIn profile PDF or Word resume, with "Map my role" for people who struggle to describe their job, then tailored per target job: company first, one proof point, three beats, under 90 seconds.
- **Story builder** (`/stories/new`, `/stories/[id]`). Pick a story type, answer scripted questions, get gentle follow-ups that push for numbers and specifics, and get the story written from your own answers as a spoken script. "Make it stronger" asks more. Stories can be deleted to start over.
- **Story finder** (`/stories/find`). For a blank page: one model call reads your resume, LinkedIn profile and Map my role answers (or three quick answers about recent work, with no resume) and suggests six to ten story moments by theme, empty themes first. Each quotes the line it comes from, and code drops any whose quote or numbers aren't in your text. One tap starts the builder with the moment filled in as the first answer, which only counts once you save it.
- **Story grading.** A different model vendor grades each story (context, ownership, reflection, level) and checks its content against your target jobs, shown in its own column with "What's working" and "To raise it".
- **Story bank and coverage grid** (home). Which question themes your stories cover, with empty themes starting the missing story, plus the mix of team- and org-level stories your target level needs.
- **Your numbers** (`/numbers`). Per role, the numbers a strong story needs and where to find them; the story builder uses what you fill in.
- **Tough questions** (`/tough-questions`). Why you're leaving, a gap, a layoff or firing, many moves, greatest weakness, a failure and salary expectations. A few plain questions about what really happened, then one call writes a 20 to 40 second answer that's true, brief and turns toward a chosen target job. It never suggests hiding or bending a fact; code checks every number against the user's answers and the length. Answers are saved in the stories table as their own type (`tough_<id>`), editable, and the prep plan's "tonight or tomorrow" plan asks for one.
- **Pre-interview brief** (`/jobs/[id]/brief`). One page per job to read just before walking in: why this company and About me for it, the likely questions each with the story to use and a one-line reminder (its result), key numbers, gaps (questions with no written story), written tough answers and the questions the user saved to ask (general ones until they save some). Assembled in code from the user's own data, no model call; reads on a phone and prints on one page. **One-minute warm-up** (`/jobs/[id]/warm-up`): About me, three numbers and the top three questions with their stories, one card at a time, full screen. Linked from the job page, and from home's plan with an interview tonight or tomorrow.
- **Questions to ask the interviewer** (job page, "Questions to ask them"). One model call (`askQuestions`) suggests five to eight questions for the end of the interview, each drawn from something in the posting and fitted to the level, grouped by who they suit (recruiter, hiring manager, future teammate, senior leader). Pay and benefits questions are dropped in code. The user saves, edits, removes or adds their own; saved ones show in the brief. New suggestions replace only the unsaved ones. Kept on `target_jobs.questions_to_ask` (jsonb).
- **Resume enhancer** (job page, "Resume bullets for this job"). One model call (`resumeBullets`) turns the user's finished behavioral stories into resume bullets (one or two each, action plus result) and marks how well each fits this job; a two-line summary comes from About me for this job (or the general one). Code checks every figure against that story's own answers and the numbers checklist, and a bullet with a figure that can't be traced is left out; role names are kept only as the user wrote them. Bullets are ordered best fit first, grouped by role, to copy into the resume the user already has; they can edit, leave out or add back bullets (edited figures are checked again). Kept on `target_jobs.resume_bullets` (jsonb); the panel says when stories changed since.
- **Question library** (`/questions`). The behavioral questions interviewers ask most, six or more per theme (the themes' templates first, some marked for senior roles), hand-written in `src/lib/questions/library.ts`. The user's own questions come first: likely questions for their target jobs and the questions asked in their past interviews, merged with the library when they're the same question. Search, pick a theme, or show only their own questions or the ones with no story yet; each question links the story that answers it or starts the one to build. No model call.
- **Interviewee profile** (`/profile`). One page on the user as a candidate: an overall summary, readiness per target job (not ready, getting there, ready), the top two or three strengths and weaknesses, each weakness with a next-step button, and what moved since they last looked. Eight criteria (story craft, evidence, level signal, theme coverage, job fit, real interview patterns, delivery, readiness) are scored in code (`src/lib/profile/assess.ts`) from story grades, the coverage grid, the numbers checklist, transcripts, practice and the journey check, and every point links to the story, grade or quote behind it. One call (`profileSummary`) writes the summary from those results only; code checks its figures and falls back to a summary written in code. Kept on `profiles.interviewee_profile` (the summary and the last two score snapshots); private to the user, and the admin panel only sees that it was opened.
- **Past interviews** (`/transcripts`). Upload or paste real interview transcripts; the review of what was asked and how each answer landed feeds likely questions and story follow-ups.
- **Mic mode.** A Talk button beside the story builder's answer box, each Map my role question and "Why this company?". The browser records 16 kHz WAV (works the same in phone Safari, Chrome and Firefox) and sends it in pieces of up to 45 seconds, cut at a pause; each piece is written down by the `transcribe` step (Whisper Large V3 through OpenRouter's speech-to-text endpoint) and added to the box to edit before sending. Audio isn't stored.
- **Delivery feedback** (practice mode). Each practice answer given with Talk gets "How you said it": pace in words a minute (aim 120 to 170), filler words with counts ("like", "you know", "um"… skipping ordinary uses such as "I'd like" or "what kind of"), and long pauses (3+ seconds between words). The mic button measures talking time and pauses from the audio level in the browser; fillers are counted from the transcript in code. No model call and no score. Speech-to-text tends to drop "um" and "uh", so the card says those can be undercounted.
- A collapsible left graphite sidebar on every signed-in page (a drawer on phones) links all of the above plus your recent stories.
- **Data privacy** (`/privacy`, `/ai-usage`, `/settings`). Privacy and AI usage policies, open without signing in and linked from sign-in and Settings; a one-line AI notice under every upload; delete account and data in one step from Settings (also deletes the person's Auth0 sign-ins when they have any). New tables that hold someone's data need a `user_id` column, which is what account deletion sweeps.
- **Usage tracking and admin panel** (`/admin`). The server records milestones (sign-up, job added, likely questions shown, story started, finished and graded, About me finished, story finder used, interview date set, journey check done) as a user id, an event name and a time: never story text, numbers or uploads, and no third-party trackers. `/admin` opens only for emails in `ADMIN_EMAILS` (checked on the server against both the session and the profile; everyone else gets a 404) and shows every user with their progress, the funnel with drop-off by step, median time from sign-up to first likely questions and to first finished story, stories per user, one user's timeline on click, and an empty review queue for features not built yet. Every admin page view is logged in `admin_views` and listed on the page. Activity from before tracking started is backfilled with estimated times.

Not built yet: the PRD's resume enhancer, paywall and success stories.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

| Command | What it does |
| --- | --- |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright; builds must exist, so run `npm run build` first) |
| `npm run ai:smoke` | One test call through each model provider that has a key set |
| `npm run eval:grade -- <folder>` | Rerun the grader on the hand-graded stories and report where it disagrees (see below) |
| `npm run db:push` | Apply `supabase/migrations` to the linked Supabase project |

## Project layout

- `src/app` – pages: `/login`, `/auth/confirm` and `/auth/continue` (email sign-in), `/` (home, prep path and story bank), `/stories/new` (pick a story type), `/stories/find` (story finder), `/stories/[id]` (the story builder, with `/stories/[id]/map` for Map my role), `/jobs`, `/jobs/new` and `/jobs/[id]` (target jobs, resume, likely questions, tailored About me), `/jobs/[id]/brief` and `/jobs/[id]/warm-up` (pre-interview brief and warm-up), `/numbers` (numbers checklist), `/transcripts` and `/transcripts/[id]` (past interviews), `/tough-questions` and `/tough-questions/[id]` (tough-questions coach)
- `src/components` – the sidebar (`nav-shell.tsx`), coverage grid, prep path and other shared pieces
- `src/lib/jobs` – target jobs, the resume, reading postings from links, PDFs, web pages and screenshots, and the one call that reads them together
- `src/lib/questions` – the ten question themes and templates, the likely-questions call, and coverage (which story answers each question)
- `src/lib/stories` – story types, the scripted questions, the model prompts, grading, fit against target jobs, and the number check
- `src/lib/brief` – the pre-interview brief and warm-up, assembled from the user's data in code
- `src/lib/ask` – questions to ask the interviewer: the list, the suggestion prompt and its checks
- `src/lib/resume` – resume enhancer: the bullet set, the writing prompt and its number and role checks
- `src/lib/tough` – the tough-questions coach: the questions, the writer's prompt and the checks on its answer
- `src/lib/finder` – the story finder: the call that suggests moments and the checks on its quotes
- `src/lib/roles` – Map my role
- `src/lib/numbers` – the numbers checklist per role family
- `src/lib/transcripts` – reading and reviewing past interview transcripts
- `src/lib/profile` – the interviewee profile: scoring in code, the summary call and its checks, snapshots for change over time
- `src/lib/usage` – usage events and `trackEvent()`; `src/lib/admin` – who is an admin, the admin panel's reads and its metrics
- `src/proxy.ts` – refreshes the Supabase or Auth0 session and sends signed-out visitors to `/login`
- `src/lib/auth0` – the Auth0 client, its proxy, the `AUTH_PROVIDER` switch and Auth0 user deletion
- `src/lib/supabase` – Supabase clients for server code and the proxy
- `src/lib/ai` – the model layer (see below)
- `supabase/migrations` – database schema, in the order to apply it (see Supabase setup below)
- `supabase/templates` – the branded sign-in emails
- `docs/build-diary.md` – what shipped, what was decided, and what feedback changed direction

## Grader eval harness

After any change to the grading prompt (`src/lib/stories/grading.ts`) or the `storyGrade` model, rerun the grader on the hand-graded stories and compare:

```bash
# Copy stories.json and grades.csv from the project's shared files (eval-harness/) into ./eval-set
npm run eval:grade                              # one grader run per story
npm run eval:grade -- --runs 3                  # three runs each, to see how stable scores are
npm run eval:grade -- --model anthropic/claude-opus-5.5   # try another grader model
```

It needs `OPENROUTER_API_KEY` in `.env.local`, prints exact and within-one agreement, the grader's bias per criterion, tier agreement and every disagreement, and saves the report to `eval-set/results/`. The stories are user data, so `eval-set/` is git-ignored; the set lives in the project's shared files. `grades.csv` has a `pre_grade` per story and criterion and a `your_grade` column for a person's correction, which wins when filled in.

## Model layer

Code calls `generateForStep("storyWrite", { system, messages })` from `src/lib/ai`. Which provider and model each step uses lives in one file, [`src/lib/ai/config.ts`](src/lib/ai/config.ts); changing a model is a one-line edit there.

| Provider | Key | Notes |
| --- | --- | --- |
| OpenRouter | `OPENROUTER_API_KEY` | Every step for now: Claude and GPT by OpenRouter slug, e.g. `anthropic/claude-opus-5.5` |
| Claude API | `ANTHROPIC_API_KEY` | Optional; switch a step's provider to `anthropic` to use it |
| OpenAI API | `OPENAI_API_KEY` | Optional; switch a step's provider to `openai` to use it |

Every OpenRouter chat call sends `provider: { data_collection: "deny" }`, so it only reaches providers that don't collect or train on prompts (the call fails rather than fall back). Keep the matching account settings on in OpenRouter (Settings → Privacy): training off and input/output logging off; they also cover speech to text. The AI usage policy page (`/ai-usage`) lists every step from `config.ts`, so a new step needs a line in `src/lib/privacy/ai-steps.ts`.

Keys are read from server environment variables only and never reach the browser. The `server-only` import in `src/lib/ai/index.ts` makes the build fail if client code imports it.

## One-time setup

### Supabase

1. Create a project at supabase.com.
2. Copy the project URL and publishable key (Project Settings → API) into `.env.local` and Vercel.
3. Apply the schema, either with the CLI (`npx supabase login`, `npx supabase link --project-ref <ref>`, `npm run db:push`) or by pasting each file below into the SQL editor, in this order. Every file after the first is safe to run more than once.

   | File | What it adds | Needed by |
   | --- | --- | --- |
   | `supabase/migrations/20261012000000_init.sql` | `profiles`, `target_jobs`, `stories`, owner-only row-level security, a profile row for each new user | Everything (#1) |
   | `supabase/migrations/20261013000000_target_jobs.sql` | Resume and jobs overview on the profile, confirmed role level, profile rows for earlier sign-ups | Target jobs (#11) |
   | `supabase/migrations/20261013010000_likely_questions.sql` | Likely questions and pasted interview reports on each target job | Likely questions (#11) |
   | `supabase/migrations/20261013020000_interview_transcripts.sql` | The `interview_transcripts` table, owner-only | Past interviews (#15) |
   | `supabase/migrations/20261014000000_numbers_checklist.sql` | The numbers checklist on the profile | Your numbers (#25) |
   | `supabase/migrations/20261014010000_intake_assessment.sql` | The intake assessment on the profile | Journey check |
   | `supabase/migrations/20261014020000_interview_date.sql` | The next interview date on each target job | Prep plan |
   | `supabase/migrations/20261014030000_story_finder.sql` | Story finder suggestions on the profile | Story finder |
   | `supabase/migrations/20261014040000_auth0_sign_in.sql` | `auth_identities`, `current_user_id()` and `claim_profile()`; owner policies use `current_user_id()` so Supabase and Auth0 tokens both work; user ids hang off `profiles` instead of `auth.users` | Auth0 sign-in |
   | `supabase/migrations/20261014050000_usage_tracking.sql` | `usage_events` and `admin_views` (no browser access), the sign-up trigger, a one-time backfill of earlier activity, and the admin panel's two count functions | Usage tracking and admin panel |
   | `supabase/migrations/20261015000000_delete_account.sql` | `delete_my_account()` and `my_sign_in_ids()`: delete every row with the caller's `user_id`, their profile and their Supabase sign-in | Delete account (Settings) |

   Each feature's pull request also left a copy of its SQL in the project's shared files (`foundation/supabase-setup.sql`, `target-jobs/run-in-supabase.sql` for the second and third rows together, `transcripts/run-in-supabase.sql`, `numbers-checklist/run-in-supabase.sql`, `assessment/run-in-supabase.sql`, `prep-plan/run-in-supabase.sql`, `story-finder/run-in-supabase.sql`, `admin-panel/run-in-supabase.sql`, `data-privacy/run-in-supabase.sql`); they match the migrations above. A page that 500s right after a merge usually means its SQL hasn't been run yet.
4. Authentication → URL Configuration: set **Site URL** to the production URL and add these **Redirect URLs**:
   - `http://localhost:3000/**`
   - `https://*-<your-vercel-team-slug>.vercel.app/**` (preview deploys)
   - the production URL with `/**`
5. Authentication → Email Templates: paste `supabase/templates/magic_link.html` into **Magic Link** (subject "Your InterviewMax sign-in link") and `supabase/templates/confirmation.html` into **Confirm signup** (subject "Welcome to InterviewMax: confirm your email"). Both link to `/auth/confirm` with a token hash, which works in any browser and survives mail scanners, and both show the 6-digit code the sign-in page accepts. Local Supabase picks them up from `supabase/config.toml`.

Supabase's built-in email sender is rate limited (a few emails an hour), which is fine for testing; set up custom SMTP before real users arrive. The Supabase project holds only InterviewMax since the Oct 14 cleanup.

New tables must write their owner policies with `(select public.current_user_id())` and default `user_id` to `public.current_user_id()`, not `auth.uid()`: `auth.uid()` errors on an Auth0 user id. `supabase/rollbacks/20261014040000_auth0_sign_in_down.sql` undoes the Auth0 migration if it has to be rolled back.

### Auth0

Only needed with `AUTH_PROVIDER=auth0`. Uses [`@auth0/nextjs-auth0`](https://github.com/auth0/nextjs-auth0) v4 and Supabase [third-party auth for Auth0](https://supabase.com/docs/guides/auth/third-party/auth0): Supabase trusts the Auth0 ID token, so row-level security still limits each user to their own rows.

1. Auth0 → Applications: a **Regular Web Application**. Allowed Callback URLs: `<site>/auth/callback`; Allowed Logout URLs and Allowed Web Origins: `<site>`, for localhost, production and the preview you test on. Copy its domain, client ID and secret into the `AUTH0_*` variables.
2. Auth0 → Authentication: turn on Google, LinkedIn (each asking for the email address) and Passwordless → Email set to send a **code**, not a link, so work mail scanners can't use it up. Enable them all for the application. The buttons on `/login` use the connection names `google-oauth2`, `linkedin` and `email`.
3. Auth0 → Actions → Triggers → post-login: an action that gives InterviewMax's ID tokens the `role` claim Supabase needs (Auth0 drops it from access tokens, so the app sends Supabase the ID token):

   ```js
   const INTERVIEWMAX_CLIENT_ID = "<the application's client ID>";
   exports.onExecutePostLogin = async (event, api) => {
     if (event.client.client_id !== INTERVIEWMAX_CLIENT_ID) return;
     api.idToken.setCustomClaim("role", "authenticated");
   };
   ```
4. Supabase → Authentication → Third-party Auth: add Auth0 with the tenant ID (and region, if the domain has one, e.g. `us` in `name.us.auth0.com`). A domain that isn't `*.auth0.com` (ours is `imax.cic-demo-platform.auth0app.com`) can't be added there; add it as a custom issuer through the Management API with a personal access token instead: `POST https://api.supabase.com/v1/projects/<ref>/config/auth/third-party-auth` with `{"oidc_issuer_url": "<the issuer from /.well-known/openid-configuration>"}`. The Auth0 application must sign tokens with RS256.
5. Apply `20261014040000_auth0_sign_in.sql`, then set `AUTH_PROVIDER=auth0`.

### Vercel

Import the GitHub repo in Vercel (framework preset: Next.js) and add the environment variables from `.env.example` to Production and Preview. Every pull request then gets a preview link.
