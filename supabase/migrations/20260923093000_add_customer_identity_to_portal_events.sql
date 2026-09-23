alter table public.customer_portal_login_events
  add column if not exists customer_name text,
  add column if not exists account_number integer;
