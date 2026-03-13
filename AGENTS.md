# Repository Guidelines

## Project Structure & Module Organization
This is a Next.js App Router app with a single backend/frontend repo.

- `app/`: routes, pages, layouts, API route handlers, and auth handoff handlers.
- `components/`: UI components by domain (`auth`, `city`, `mobile`, `play`, `shared`, `ui`).
- `lib/`: simulation engine, agents, auth/data helpers, validation, state management, and Supabase/Stack integrations.
- `tests/`: unit, integration, and agent tests (`unit`, `integration`, `sim`, `e2e`, `agents`).
- `public/`: static assets.
- `supabase/`: SQL migrations and database-related artifacts.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start local dev server at `http://localhost:3000`.
- `npm run build`: compile and type-check production build.
- `npm run start`: run the production build.
- `npm run lint`: run ESLint checks.
- `npx vitest run`: run all tests.
- `npx vitest run tests/unit tests/sim tests/agents`: run fast deterministic suites during iteration.
- `cp .env.example .env.local`: bootstrap local env; fill Stack, Supabase, and optional OpenAI keys.

## Coding Style & Naming Conventions
- Language: TypeScript, strict-ish typing where practical.
- Indentation: 2 spaces.
- Prefer small, pure functions in `lib/sim` and `lib/agents` for deterministic behavior.
- Component names: PascalCase (`FounderAgentCard.tsx`).
- Route/API files follow App Router conventions (`app/api/.../route.ts`, `app/city/[roomId]/page.tsx`).
- Validation defaults: prefer Zod schemas for request/agent payloads.
- Lint config is in `eslint.config.mjs`.

## Testing Guidelines
- Unit/integration tests use `vitest`.
- Keep tests colocated by domain under `tests/`.
- File naming: `*.test.ts` or `*.test.tsx`.
- Focus coverage on simulation determinism, vote resolution, scoring, and AI fallback paths.
- Use seeds for deterministic simulation tests (`createInitialCityState`, fixed IDs).

## Security & Configuration
- Never commit `.env.local` (it is gitignored).
- Required local/runtime keys are in `.env.example`:
  - Stack: `NEXT_PUBLIC_STACK_PROJECT_ID`, `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`, `STACK_SECRET_SERVER_KEY`
  - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Treat service keys as secrets; rotate if exposed.

## Commit & Pull Request Guidelines
- Keep commits focused and single-purpose.
- Use imperative summary-style subject lines (e.g., `Add founder fallback speech bubble states`).
- PRs should include: intent, files touched, test command/output, and migration notes if DB schema changed.
