begin;

alter table public.numero_cliente
  add column if not exists prepaid_allowance_cubic_feet numeric(12,2) not null default 0,
  add column if not exists prepaid_used_cubic_feet numeric(12,2) not null default 0,
  add column if not exists prepaid_notice_level integer not null default 0;

alter table public.paquetes_registro
  add column if not exists cubic_feet numeric(12,2),
  add column if not exists prepaid_review_required boolean not null default false,
  add column if not exists prepaid_review_status text not null default 'NOT_REQUIRED',
  add column if not exists prepaid_reviewed_at timestamptz,
  add column if not exists prepaid_reviewed_by uuid references auth.users(id) on delete set null;

create index if not exists paquetes_registro_prepaid_review_idx
  on public.paquetes_registro(prepaid_review_required, prepaid_review_status, creado_en desc);
create index if not exists numero_cliente_prepaid_idx
  on public.numero_cliente(prepaid_allowance_cubic_feet, prepaid_used_cubic_feet);

create table if not exists public.pickup_signatures (
  id uuid primary key default gen_random_uuid(),
  numero_cliente_id uuid references public.numero_cliente(id) on delete set null,
  shipment_ids uuid[] not null default '{}',
  trackings text[] not null default '{}',
  signature_paths jsonb not null default '[]'::jsonb,
  signed_at timestamptz not null default now(),
  captured_by uuid references auth.users(id) on delete set null,
  captured_by_role text not null default 'staff'
);
create index if not exists pickup_signatures_customer_idx
  on public.pickup_signatures(numero_cliente_id, signed_at desc);
create index if not exists pickup_signatures_signed_idx
  on public.pickup_signatures(signed_at desc);

create table if not exists public.prepaid_notification_log (
  id uuid primary key default gen_random_uuid(),
  numero_cliente_id uuid references public.numero_cliente(id) on delete cascade,
  level integer not null,
  used_cubic_feet numeric(12,2) not null,
  allowance_cubic_feet numeric(12,2) not null,
  sent_to text,
  sent_at timestamptz not null default now(),
  unique(numero_cliente_id, level)
);

create table if not exists public.admin_search_mirror (
  id uuid primary key,
  tracking text,
  estado text,
  tipo_paquete text,
  nombre_paqueteria text,
  numero_cliente_id uuid,
  customer_name text,
  customer_email text,
  customer_account_number bigint,
  puerto text,
  billing_total numeric,
  invoice_status text,
  approval_status text,
  issue_status text,
  prepaid_review_required boolean not null default false,
  prepaid_review_status text,
  cubic_feet numeric,
  creado_en timestamptz,
  refreshed_at timestamptz not null default now()
);
create index if not exists admin_search_mirror_tracking_idx on public.admin_search_mirror(tracking);
create index if not exists admin_search_mirror_customer_idx on public.admin_search_mirror(customer_name, customer_account_number, customer_email);
create index if not exists admin_search_mirror_port_idx on public.admin_search_mirror(puerto, creado_en desc);
create index if not exists admin_search_mirror_stage_idx on public.admin_search_mirror(estado, creado_en desc);

create or replace function public.refresh_admin_search_mirror()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.admin_search_mirror (
    id, tracking, estado, tipo_paquete, nombre_paqueteria, numero_cliente_id,
    customer_name, customer_email, customer_account_number, puerto, billing_total,
    invoice_status, approval_status, issue_status, prepaid_review_required,
    prepaid_review_status, cubic_feet, creado_en, refreshed_at
  )
  select
    p.id, p.tracking, p.estado, p.tipo_paquete, p.nombre_paqueteria, p.numero_cliente_id,
    c.nombre, c.email, c.numero_cliente, c.puerto, p.billing_total,
    p.invoice_status, p.approval_status, p.issue_status, p.prepaid_review_required,
    p.prepaid_review_status, p.cubic_feet, p.creado_en, now()
  from public.paquetes_registro p
  left join public.numero_cliente c on c.id = p.numero_cliente_id
  on conflict (id) do update set
    tracking = excluded.tracking, estado = excluded.estado,
    tipo_paquete = excluded.tipo_paquete, nombre_paqueteria = excluded.nombre_paqueteria,
    numero_cliente_id = excluded.numero_cliente_id, customer_name = excluded.customer_name,
    customer_email = excluded.customer_email, customer_account_number = excluded.customer_account_number,
    puerto = excluded.puerto, billing_total = excluded.billing_total,
    invoice_status = excluded.invoice_status, approval_status = excluded.approval_status,
    issue_status = excluded.issue_status, prepaid_review_required = excluded.prepaid_review_required,
    prepaid_review_status = excluded.prepaid_review_status, cubic_feet = excluded.cubic_feet,
    creado_en = excluded.creado_en, refreshed_at = now();
  delete from public.admin_search_mirror m where not exists (select 1 from public.paquetes_registro p where p.id = m.id);
$$;

commit;
