begin;

alter table public.numero_cliente
  add column if not exists billing_mode text not null default 'POSTPAID';

alter table public.numero_cliente
  drop constraint if exists numero_cliente_billing_mode_check;

alter table public.numero_cliente
  add constraint numero_cliente_billing_mode_check
  check (billing_mode in ('POSTPAID', 'PREPAID'));

create index if not exists numero_cliente_billing_mode_idx
  on public.numero_cliente (billing_mode, tipo_cuenta);

commit;
