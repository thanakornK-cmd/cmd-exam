# Event Register App

Single Next.js app for public registration, applicant self-service, admin review, API routes, and document/name-tag handling.

## Run

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` if you want to override the defaults.

## Architecture

- One deployable app only: Next.js App Router at the repo root
- User pages, admin pages, and backend logic live in the same app
- Route handlers under `src/app/api/*` implement the server-side flows directly
- Registration state currently uses an in-memory server-state seam inside the app
- Uploaded files currently use an internal inline storage seam so the app no longer depends on a separate backend or writable local upload directory

## Relevant scripts

```bash
npm run test
npm run lint
npm run build
```

## Vercel note

The code is shaped for a Vercel-only deployment model, but two production seams are still intentionally lightweight:

- app state is currently kept in process memory rather than Postgres
- uploaded files use an inline storage seam rather than a live Vercel Blob adapter

That keeps the app self-contained and buildable while leaving clean swap points for Postgres and Blob-backed runtime integration.
