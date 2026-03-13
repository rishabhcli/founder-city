create table if not exists public.rooms (
  id text primary key,
  name text not null,
  stack_team_id text null,
  host_user_id text not null,
  invite_code text not null unique,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'paused', 'ended')),
  active_run_id text null,
  created_at timestamptz not null default now()
);

create table if not exists public.runs (
  id text primary key,
  room_id text not null references public.rooms(id) on delete cascade,
  seed text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  final_scores jsonb null,
  state jsonb not null
);

alter table public.rooms
  add constraint rooms_active_run_fkey
  foreign key (active_run_id) references public.runs(id)
  on delete set null;

create table if not exists public.run_votes (
  run_id text not null references public.runs(id) on delete cascade,
  round_id text not null,
  voter_key text not null,
  option_id text not null,
  created_at timestamptz not null default now(),
  primary key (run_id, round_id, voter_key)
);

create table if not exists public.run_checkpoints (
  id bigserial primary key,
  run_id text not null references public.runs(id) on delete cascade,
  tick integer not null,
  state jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists rooms_invite_code_idx on public.rooms(invite_code);
create index if not exists runs_room_id_idx on public.runs(room_id);
create index if not exists runs_status_idx on public.runs(status);
create index if not exists run_votes_run_round_idx on public.run_votes(run_id, round_id);
create index if not exists run_checkpoints_run_created_idx on public.run_checkpoints(run_id, created_at desc);
