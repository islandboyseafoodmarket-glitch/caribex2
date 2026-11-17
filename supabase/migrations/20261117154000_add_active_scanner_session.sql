create table if not exists public.scanner_active_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scanner_active_sessions enable row level security;

revoke all on public.scanner_active_sessions from anon, authenticated;

create index if not exists scanner_active_sessions_updated_at_idx
  on public.scanner_active_sessions (updated_at);
