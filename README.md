# Founder City

Founder City is a multiplayer city simulation where startup agents move through a stylized San Francisco board and change identity based on city interventions.

## Stack

- Next.js App Router (TypeScript)
- Supabase Postgres + Realtime
- Stack Auth (demo fallback supported)
- Zustand
- Tailwind CSS / Framer Motion
- OpenAI optional for hero agent decisions

## Quickstart

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

3. Fill required keys in `.env.local`:

- `NEXT_PUBLIC_STACK_PROJECT_ID`
- `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`
- `STACK_SECRET_SERVER_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

4. Start:

```bash
npm run dev
```

- Lobby: `http://localhost:3000/play`
- Create/Join: `http://localhost:3000/play`
- Audience join: `http://localhost:3000/join/<roomId>`

## Database

Apply the migration at:

`supabase/migrations/20260313_founder_city_core.sql`

If `active_run_id` references are not needed in the UI, keep that FK in place for consistency.

## Behavior

- Without full Stack + Supabase config, the app runs in demo mode with in-memory persistence.
- When both are configured, host session state is persisted in Postgres while the simulation loop remains host-authoritative in memory.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
