begin;

drop index if exists public.numero_cliente_account_review_idx;

alter table public.numero_cliente
  drop column if exists account_review_status,
  drop column if exists account_reviewed_at,
  drop column if exists account_reviewed_by,
  drop column if exists account_review_notes;

commit;
