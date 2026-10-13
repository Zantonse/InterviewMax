# InterviewMax

A guided path that turns an experienced candidate's own work history into metric-backed behavioral interview stories aimed at the jobs they're targeting.

Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres, magic-link auth, row-level security), Vercel, Vitest and Playwright. Model calls go through our own thin layer over the Claude API, the OpenAI API and OpenRouter.

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

- `src/app` – pages: `/login` (magic link), `/auth/confirm` (email link lands here), `/` (home and story bank), `/stories/new` (pick a story type), `/stories/[id]` (the story builder)
- `src/lib/stories` – story types, the scripted questions, the two model prompts and the number check
- `src/proxy.ts` – refreshes the Supabase session and sends signed-out visitors to `/login`
- `src/lib/supabase` – Supabase clients for server code and the proxy
- `src/lib/ai` – the model layer (see below)
- `supabase/migrations` – database schema: `profiles`, `target_jobs`, `stories`, all owner-only via RLS

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
3. Apply the schema: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npm run db:push`. (Or paste `supabase/migrations/*.sql` into the SQL editor.)
4. Authentication → URL Configuration: set **Site URL** to the production URL and add these **Redirect URLs**:
   - `http://localhost:3000/**`
   - `https://*-<your-vercel-team-slug>.vercel.app/**` (preview deploys)
   - the production URL with `/**`
5. Optional but recommended: Authentication → Email Templates → Magic Link, change the link to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` so the link also works when opened in a different browser from the one that requested it. With the default template it still works, as long as it's opened in the same browser.

Supabase's built-in email sender is rate limited (a few emails an hour), which is fine for testing; set up custom SMTP before real users arrive.

### Vercel

Import the GitHub repo in Vercel (framework preset: Next.js) and add the environment variables from `.env.example` to Production and Preview. Every pull request then gets a preview link.
