alter table public.numero_cliente
  add column if not exists prepaid_rate_per_cubic_foot numeric(10,2) not null default 18.50;

comment on column public.numero_cliente.prepaid_rate_per_cubic_foot is
  'Customer-specific prepaid cubic-foot billing rate; defaults to the standard rate.';
