# InterviewMax

A guided path that turns an experienced candidate's own work history into metric-backed behavioral interview stories aimed at the jobs they're targeting.

Live: [interview-max-mauve.vercel.app](https://interview-max-mauve.vercel.app). Product spec: [PRD v0.3](https://claude.ai/code/artifact/3178b97a-ea69-472a-b407-c4f511895d27). What shipped and why: [docs/build-diary.md](docs/build-diary.md).

Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres, email sign-in, row-level security), Vercel, Vitest and Playwright. Model calls go through our own thin layer over OpenRouter, the Claude API and the OpenAI API.

## What it does

- **Sign in** with a magic link or a 6-digit code from the same email. The link opens a "One more click" page first, so a work email's link scanner can't use it up.
- **Value first.** Paste a job posting and see its likely behavioral questions straight away; the rest of the setup can wait.
- **Target jobs** (`/jobs`). Add a job from a link to its posting, a PDF, a saved web page (.html/.mhtml), screenshots, or typed text; any one is enough. LinkedIn, Indeed and Glassdoor block link fetching, so the form asks for a paste there. Each job gets its role level, likely questions (themed, informed by interview reports you paste), and a read of how it compares with your resume and other jobs.
- **Tell me about yourself.** Filled in from a LinkedIn profile PDF or Word resume, with "Map my role" for people who struggle to describe their job, then tailored per target job: company first, one proof point, three beats, under 90 seconds.
- **Story builder** (`/stories/new`, `/stories/[id]`). Pick a story type, answer scripted questions, get gentle follow-ups that push for numbers and specifics, and get the story written from your own answers as a spoken script. "Make it stronger" asks more. Stories can be deleted to start over.
- **Story grading.** A different model vendor grades each story (context, ownership, reflection, level) and checks its content against your target jobs, shown in its own column with "What's working" and "To raise it".
- **Story bank and coverage grid** (home). Which question themes your stories cover, with empty themes starting the missing story, plus the mix of team- and org-level stories your target level needs.
- **Your numbers** (`/numbers`). Per role, the numbers a strong story needs and where to find them; the story builder uses what you fill in.
- **Past interviews** (`/transcripts`). Upload or paste real interview transcripts; the review of what was asked and how each answer landed feeds likely questions and story follow-ups.
- A collapsible left navy sidebar on every signed-in page (a drawer on phones) links all of the above plus your recent stories.

Not built yet: mic mode, the evaluation harness for the grader (waiting on about 10 hand-graded stories), and the PRD's resume enhancer, paywall and success stories.

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
| `npm run db:push` | Apply `supabase/migrations` to the linked Supabase project |

## Project layout

- `src/app` – pages: `/login`, `/auth/confirm` and `/auth/continue` (email sign-in), `/` (home, prep path and story bank), `/stories/new` (pick a story type), `/stories/[id]` (the story builder, with `/stories/[id]/map` for Map my role), `/jobs`, `/jobs/new` and `/jobs/[id]` (target jobs, resume, likely questions, tailored About me), `/numbers` (numbers checklist), `/transcripts` and `/transcripts/[id]` (past interviews)
- `src/components` – the sidebar (`nav-shell.tsx`), coverage grid, prep path and other shared pieces
- `src/lib/jobs` – target jobs, the resume, reading postings from links, PDFs, web pages and screenshots, and the one call that reads them together
- `src/lib/questions` – the ten question themes and templates, the likely-questions call, and coverage (which story answers each question)
- `src/lib/stories` – story types, the scripted questions, the model prompts, grading, fit against target jobs, and the number check
- `src/lib/roles` – Map my role
- `src/lib/numbers` – the numbers checklist per role family
- `src/lib/transcripts` – reading and reviewing past interview transcripts
- `src/proxy.ts` – refreshes the Supabase session and sends signed-out visitors to `/login`
- `src/lib/supabase` – Supabase clients for server code and the proxy
- `src/lib/ai` – the model layer (see below)
- `supabase/migrations` – database schema, in the order to apply it (see Supabase setup below)
- `supabase/templates` – the branded sign-in emails
- `docs/build-diary.md` – what shipped, what was decided, and what feedback changed direction

## Model layer

Code calls `generateForStep("storyWrite", { system, messages })` from `src/lib/ai`. Which provider and model each step uses lives in one file, [`src/lib/ai/config.ts`](src/lib/ai/config.ts); changing a model is a one-line edit there.

| Provider | Key | Notes |
| --- | --- | --- |
| OpenRouter | `OPENROUTER_API_KEY` | Every step for now: Claude and GPT by OpenRouter slug, e.g. `anthropic/claude-opus-5.5` |
| Claude API | `ANTHROPIC_API_KEY` | Optional; switch a step's provider to `anthropic` to use it |
| OpenAI API | `OPENAI_API_KEY` | Optional; switch a step's provider to `openai` to use it |

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

   Each feature's pull request also left a copy of its SQL in the project's shared files (`foundation/supabase-setup.sql`, `target-jobs/run-in-supabase.sql` for the second and third rows together, `transcripts/run-in-supabase.sql`, `numbers-checklist/run-in-supabase.sql`); they match the migrations above. A page that 500s right after a merge usually means its SQL hasn't been run yet.
4. Authentication → URL Configuration: set **Site URL** to the production URL and add these **Redirect URLs**:
   - `http://localhost:3000/**`
   - `https://*-<your-vercel-team-slug>.vercel.app/**` (preview deploys)
   - the production URL with `/**`
5. Authentication → Email Templates: paste `supabase/templates/magic_link.html` into **Magic Link** (subject "Your InterviewMax sign-in link") and `supabase/templates/confirmation.html` into **Confirm signup** (subject "Welcome to InterviewMax: confirm your email"). Both link to `/auth/confirm` with a token hash, which works in any browser and survives mail scanners, and both show the 6-digit code the sign-in page accepts. Local Supabase picks them up from `supabase/config.toml`.

Supabase's built-in email sender is rate limited (a few emails an hour), which is fine for testing; set up custom SMTP before real users arrive. The current Supabase project is shared with another app; InterviewMax should move to its own project before real users.

### Vercel

Import the GitHub repo in Vercel (framework preset: Next.js) and add the environment variables from `.env.example` to Production and Preview. Every pull request then gets a preview link.
