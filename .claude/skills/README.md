# Project skills

Claude Code picks these up automatically in every session on this repo.

Four skills are copied unchanged from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (commit `aeac41d`, MIT licence in `LICENSE-agent-skills`):

- `security-and-hardening`: threat-model and harden anything that takes user input, uploads, model output, auth, payments or personal data.
- `test-driven-development`: write the failing test first; reproduce a bug before fixing it.
- `source-driven-development`: check official docs before writing framework-specific code (this Next.js version differs from training data; see `AGENTS.md`).
- `deprecation-and-migration`: remove or replace features and change the live Supabase schema in safe expand/contract steps.

The only edit: links to the upstream repo's shared `references/` folder now point at copies inside the skills' own `references/` folders.
