create table if not exists public.customer_portal_login_events (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  event_type text not null default 'login_attempt',
  success boolean not null default false,
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists customer_portal_login_events_created_at_idx
  on public.customer_portal_login_events(created_at desc);

create index if not exists customer_portal_login_events_email_idx
  on public.customer_portal_login_events(email, created_at desc);

alter table public.customer_portal_login_events enable row level security;

create policy "Admins and staff can view portal login events"
  on public.customer_portal_login_events
  for select
  to authenticated
  using (
    exists (select 1 from public.administradores where id = auth.uid())
    or exists (select 1 from public.personal where id = auth.uid())
  );
