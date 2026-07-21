# Contributing / workflow

Production is **https://signalab.other-ai.com**, deployed by Vercel from `main`.
`main` is protected: no direct pushes, PRs only, and the **Vercel** build check
must be green before merge (branch must also be up to date with `main`).

## Day-to-day loop

```bash
git checkout main && git pull
git checkout -b feat/my-change
# ...work...
npm run build && npm run lint     # both must pass locally too
git push -u origin feat/my-change
gh pr create                      # Vercel builds a PREVIEW deployment
# test on the preview URL from the PR, then merge -> production deploys
```

Pushing any non-`main` branch is always safe: it only creates a preview
deployment with its own URL (same env vars, zero production impact).

## Repo layout notes

- `infra/` — independent AWS CDK package (own npm install / build / lint).
  Excluded from the app's TypeScript build; deploy is operator-run
  (see `infra/README.md`). Never commit stack outputs or credentials.
- `src/lib/aws/` — server-only (guarded by `server-only`). All data access goes
  through `src/app/api/*` route handlers; every handler verifies the Cognito
  access token and scopes reads/writes to the caller's `userId`. There is no
  row-level security in DynamoDB — treat any unscoped query as a bug.
- `src/lib/vision/` — MediaPipe hand-landmark utilities (see its README).
- Participant-facing copy is Spanish (es-MX), sentence case, no exclamation
  marks; "Lengua de Señas Mexicana / LSM" (never "lenguaje de señas"),
  "persona sorda" (never "sordomudo").

## Environment

Copy `.env.local.example` to `.env.local` and fill from the deployed
`SignalabPilotStack` outputs. Secrets live only in `.env.local` (gitignored)
and in Vercel project env vars — never in the repo.
