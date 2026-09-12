create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null,
  telefono text,
  mensaje text not null,
  service_type text,
  status text not null default 'NEW' check (status in ('NEW', 'CONTACTED', 'CONVERTED', 'CLOSED')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_submissions enable row level security;

-- Public visitors may create a lead, but cannot read or modify leads.
drop policy if exists "public can submit contact lead" on public.contact_submissions;
create policy "public can submit contact lead"
  on public.contact_submissions for insert
  to anon, authenticated
  with check (true);

-- Authenticated admin users may manage leads. The app also enforces the admin role in its UI.
drop policy if exists "admins can view contact leads" on public.contact_submissions;
create policy "admins can view contact leads"
  on public.contact_submissions for select
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'administrator'));

drop policy if exists "admins can update contact leads" on public.contact_submissions;
create policy "admins can update contact leads"
  on public.contact_submissions for update
  to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'administrator'))
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'administrator'));

create index if not exists contact_submissions_created_at_idx on public.contact_submissions (created_at desc);
create index if not exists contact_submissions_status_idx on public.contact_submissions (status);
