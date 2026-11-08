# Simulated users

AI personas with made-up work histories sign in to a Vercel preview and try to build one behavioral
story end to end, the way a real user would. A different OpenRouter model plays each persona, so
the answers vary in style. Afterwards a cheap model reads every transcript and writes an insights
report: how far each persona got, where they got stuck, how good the story was, patterns across
personas and models, and a ranked list of fixes.

It catches breakage and obvious friction. It can't tell you whether the builder *feels* hard
(personas don't feel dread or fatigue), and AI judging AI is biased, so confirm what matters with
real testers.

## When it runs

- **Every 3 days** (`.github/workflows/sims.yml`): the workflow points the `sims/main` branch at
  `main`, waits until Vercel's preview of it serves that commit, then runs against it.
- **Run workflow button** in GitHub Actions → Simulated users. Paste a preview URL to test that
  preview (for a story builder PR, its preview URL from the Vercel comment), and optionally pick
  personas and models. Leave the URL empty for a fresh preview of `main`.

The live Vercel project sends GitHub no deployment events, so nothing starts a run on its own
when a PR's preview is ready. The `sims/main` preview URL is
`https://interview-max-git-sims-main-craigverzosa-5395s-projects.vercel.app`; set the
`SIM_MAIN_PREVIEW_URL` repository variable if that changes. Runs never overlap, since they share the
persona accounts. Until the GitHub secrets exist, runs skip themselves instead of failing.

The report shows on the run's **Summary** page and at the end of the "Run the personas" log. The transcript and a screenshot of every step
are in the run's `simulated-users-<n>` file.

## Personas and models

- Personas: `src/lib/sims/personas.ts`. They are a sales engineer, a product designer and a
  data governance lead, each with a voice, a patience level, a work history and a target job.
  Everything in them is made up.
- Models: `src/lib/sims/models.ts`. Persona models rotate with each run, so over a few runs every
  persona is played by every model. The analyst is the first available cheap model. The app's own
  builder and grader keep the models in `src/lib/ai/config.ts`, so the runs test what users get.

## How a run works

1. `POST /api/sims/session` (preview only, needs `SIM_USERS_SECRET`) signs the persona in through
   Auth0 with a password, using a connection only the persona accounts use. It wipes the persona's
   old account, makes a fresh profile flagged `is_simulated` with "Your field" set, and sets the
   Auth0 session cookie.
2. Playwright opens `/`. Each step, the persona model sees the page text and a numbered list of
   controls, and replies with one action (click, type, select, wait, done or give up) plus a
   one-line thought. Sign out, delete, upload and microphone controls are hidden from it.
3. `POST /api/sims/result` returns what the persona made (stories, jobs, usage events, click
   signals), then deletes the account. The runner scores the run (`src/lib/sims/score.ts`).
4. The analyst model writes the insights (`src/lib/sims/report.ts`).

Persona accounts never count in /admin: `src/lib/admin/data.ts` leaves out every profile with
`is_simulated`.

## One-time setup

1. **Supabase:** run `supabase/migrations/20261107000000_simulated_users.sql` (adds the
   `is_simulated` column). Persona sign-in refuses to start until it exists.
2. **Auth0** (tenant `imax`):
   1. Applications → Create Application → Regular Web Application, named `InterviewMax Sims`.
      In its Advanced Settings → Grant Types, turn on **Password**. Note its Client ID and Secret.
   2. Authentication → Database → Create DB Connection, named `interviewmax-sims`, and tick
      **Disable Sign Ups** so nobody else can make an account in it. In its Applications
      tab, enable it for **InterviewMax Sims only**, not for the InterviewMax app, so it never
      shows on the sign-in page. In its Attributes tab, add **Email** as an identifier active for
      login (the runs sign in by email; Username alone gives "Wrong email or password").
   3. User Management → Users → Create User, connection `interviewmax-sims`, once per persona:
      `sim-sales-engineer@sims.interviewmax.test`, `sim-product-designer@sims.interviewmax.test`,
      `sim-data-governance@sims.interviewmax.test`, `sim-sales-engineer-junior@sims.interviewmax.test`,
      `sim-sales-engineer-principal@sims.interviewmax.test`,
      `sim-data-governance-junior@sims.interviewmax.test`,
      `sim-data-governance-senior@sims.interviewmax.test`, all with the same long random password.
   4. Actions → the post-login action that sets the `role` claim: let it run for the Sims app too,
      e.g. `if (![INTERVIEWMAX_CLIENT_ID, SIMS_CLIENT_ID].includes(event.client.client_id)) return;`.
3. **Vercel → Settings → Environment Variables, Preview only** (never Production):
   `SIM_USERS_SECRET` (`openssl rand -hex 32`), `SIM_AUTH0_CLIENT_ID`, `SIM_AUTH0_CLIENT_SECRET`,
   `SIM_USERS_PASSWORD` (the persona password). Optional: `SIM_AUTH0_CONNECTION` (default
   `interviewmax-sims`), `SIM_EMAIL_DOMAIN` (default `sims.interviewmax.test`). Previews also need
   the usual app variables (Supabase, Auth0, OpenRouter).
4. **Vercel → Settings → Deployment Protection → Protection Bypass for Automation:** create a
   secret, since previews are behind Vercel Authentication.
5. **GitHub → Settings → Secrets and variables → Actions:** `SIM_USERS_SECRET` (same value as
   Vercel), `SIMS_OPENROUTER_API_KEY` (a separate OpenRouter key with a monthly limit, e.g. $50),
   `VERCEL_AUTOMATION_BYPASS_SECRET` (from step 4).

## Running it yourself

```sh
SIM_USERS_SECRET=… OPENROUTER_API_KEY=… VERCEL_AUTOMATION_BYPASS_SECRET=… \
  npm run sims -- https://<preview-url>
```

`SIM_PERSONAS=product-designer` runs one persona, `SIM_MODELS=vendor/model` picks the persona
model, `SIM_MAX_STEPS` caps the steps (default 80), and `SIM_KEEP_ACCOUNTS=1` keeps the persona
account afterwards so you can look at it on the preview. Output goes to `sims-out/`.

## Cost

Roughly $0.85 a run at Nov 2026 list prices: the app's grader (GPT 5.5) is most of it, on the
app's OpenRouter key; persona and analyst calls are on `SIMS_OPENROUTER_API_KEY`, and the report
prints what they cost. Every 3 days is about $8 a month.
