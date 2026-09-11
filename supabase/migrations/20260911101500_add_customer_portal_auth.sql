begin;

alter table public.numero_cliente
  add column if not exists auth_user_id uuid unique references auth.users(id) on update cascade on delete set null;

create table if not exists public.customer_password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  numero_cliente_id uuid references public.numero_cliente(id) on update cascade on delete set null,
  email text not null,
  status varchar(20) not null default 'requested' check (status in ('requested', 'completed', 'dismissed')),
  requested_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on update cascade on delete set null
);

create index if not exists customer_password_reset_requests_status_idx
  on public.customer_password_reset_requests(status, requested_at desc);

alter table public.customer_password_reset_requests enable row level security;

commit;
