begin;

alter table public.numero_cliente
  add column if not exists account_review_status text not null default 'ACTIVE',
  add column if not exists account_reviewed_at timestamptz,
  add column if not exists account_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists account_review_notes text;

create index if not exists numero_cliente_account_review_idx
  on public.numero_cliente(account_review_status, tipo_cuenta, creado_en desc);

commit;
