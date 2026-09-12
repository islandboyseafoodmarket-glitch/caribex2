begin;

create table if not exists public.customer_leads (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null,
  mensaje text not null,
  asunto text,
  fuente varchar(40) not null default 'landing_page',
  estado varchar(20) not null default 'nuevo'
    check (estado in ('nuevo', 'contactado', 'cerrado', 'spam')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists customer_leads_status_idx
  on public.customer_leads (estado, creado_en desc);

create index if not exists customer_leads_email_idx
  on public.customer_leads (email);

alter table public.customer_leads enable row level security;

commit;
