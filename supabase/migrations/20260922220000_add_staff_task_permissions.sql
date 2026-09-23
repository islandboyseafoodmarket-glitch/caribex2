alter table public.personal
  add column if not exists permissions jsonb not null default '{"shipment_workflow": true, "client360": true, "invoices": true, "invoice_edit": false, "ferry_manifests": false}'::jsonb;

comment on column public.personal.permissions is 'Task-level permissions granted by an administrator to staff accounts.';
