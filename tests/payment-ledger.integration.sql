-- ISOLATED LOCAL POSTGRES TEST ONLY. Never run this fixture on production.
\set ON_ERROR_STOP on
create schema if not exists auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('caribex.test_user',true),'')::uuid $$;
create table public.administradores(id uuid primary key);
create table public.paquetes_registro(id uuid primary key, billing_total numeric, invoice_status text, payment_method text, payment_reference text, payment_notes text, payment_date date, customer_invoice_note text);
insert into public.administradores values ('00000000-0000-0000-0000-000000000001');
insert into public.paquetes_registro(id,billing_total,invoice_status,payment_method,payment_date) values
('00000000-0000-0000-0000-000000000101',100,'SENT',null,null),
('00000000-0000-0000-0000-000000000102',50,'PAID','Cash',null),
('00000000-0000-0000-0000-000000000103',200,'SENT',null,null);
\ir ../supabase/migrations/20261026100000_add_immutable_invoice_payments.sql

do $$
declare
  a uuid := '00000000-0000-0000-0000-000000000001';
  i uuid := '00000000-0000-0000-0000-000000000101';
  payment_id uuid;
  r record;
  rejected boolean;
begin
  assert (select count(*) from invoice_payment_entries where is_legacy)=1, 'legacy import count';
  assert (select payment_date is null from invoice_payment_entries where is_legacy), 'unknown legacy payment date must stay unknown';
  select * into r from record_invoice_payment(i,60,'Cash',null,null,'2026-10-26','00000000-0000-0000-0000-000000000201',a);
  payment_id:=r.entry_id;
  assert r.paid=60 and r.balance=100-60 and r.invoice_status='SENT', 'partial payment';
  select * into r from record_invoice_payment(i,60,'Cash',null,null,'2026-10-26','00000000-0000-0000-0000-000000000201',a);
  assert r.replayed, 'idempotent replay';
  rejected:=false;
  begin
    perform record_invoice_payment(i,61,'Cash',null,null,'2026-10-26','00000000-0000-0000-0000-000000000201',a);
  exception when others then rejected:=sqlerrm like '%IDEMPOTENCY_CONFLICT%'; end;
  assert rejected, 'changed payload with same request key must fail';
  select * into r from record_invoice_payment(i,40,'Zelle','test-reference',null,'2026-10-26','00000000-0000-0000-0000-000000000202',a);
  assert r.paid=100 and r.balance=0 and r.invoice_status='PAID', 'full settlement';
  rejected:=false;
  begin
    perform record_invoice_payment(i,1,'Cash',null,null,'2026-10-26','00000000-0000-0000-0000-000000000204',a);
  exception when others then rejected:=sqlerrm like '%EXCEEDS_OUTSTANDING_BALANCE%'; end;
  assert rejected, 'overpayment must fail';
  select * into r from reverse_invoice_payment(payment_id,'Local test correction','00000000-0000-0000-0000-000000000203',a,'2026-10-26');
  assert r.paid=100-60 and r.balance=60 and r.invoice_status='PENDING', 'reversal restores balance';
  select * into r from reverse_invoice_payment(payment_id,'Local test correction','00000000-0000-0000-0000-000000000203',a,'2026-10-26');
  assert r.replayed, 'reversal replay';
  rejected:=false;
  begin
    perform reverse_invoice_payment(payment_id,'Different correction','00000000-0000-0000-0000-000000000205',a,'2026-10-26');
  exception when others then rejected:=sqlerrm like '%PAYMENT_ALREADY_REVERSED%'; end;
  assert rejected, 'payment can only be reversed once';
  perform set_config('caribex.payment_ledger_write','rpc',true);
  rejected:=false;
  begin update invoice_payment_entries set notes='bad mutation' where id=payment_id;
  exception when insufficient_privilege then rejected:=true; end;
  assert rejected, 'UPDATE forbidden even with RPC marker';
  rejected:=false;
  begin delete from invoice_payment_entries where id=payment_id;
  exception when insufficient_privilege then rejected:=true; end;
  assert rejected, 'DELETE forbidden';
  rejected:=false;
  begin truncate invoice_payment_entries;
  exception when insufficient_privilege then rejected:=true; end;
  assert rejected, 'TRUNCATE forbidden';
  perform set_config('caribex.payment_ledger_write','',true);
  rejected:=false;
  begin update paquetes_registro set invoice_status='PAID' where id=i;
  exception when insufficient_privilege then rejected:=true; end;
  assert rejected, 'old mark-paid path cannot bypass ledger';
  rejected:=false;
  begin update paquetes_registro set payment_method='PayPal' where id='00000000-0000-0000-0000-000000000102';
  exception when insufficient_privilege then rejected:=true; end;
  assert rejected, 'legacy payment summary cannot be overwritten';
  perform record_invoice_payment('00000000-0000-0000-0000-000000000103',200,'Wire',null,null,'2026-10-26','00000000-0000-0000-0000-000000000206',a);
  assert not has_table_privilege('authenticated','invoice_payment_balances','SELECT'), 'balance view restricted to server';
  assert not has_table_privilege('service_role','invoice_payment_entries','INSERT'), 'direct service-role insert forbidden';
end $$;
\ir ../supabase/migrations/20261026100000_add_immutable_invoice_payments.sql

do $$ begin
  assert (select count(*) from invoice_payment_entries where invoice_id='00000000-0000-0000-0000-000000000103')=1, 'migration rerun must not duplicate newly paid invoices';
  assert (select count(*) from invoice_payment_entries where invoice_id='00000000-0000-0000-0000-000000000101')=3, 'original payments and reversal all retained';
  assert (select paid from invoice_payment_balances where invoice_id='00000000-0000-0000-0000-000000000103')=200, 'rerun preserves amount';
end $$;
select 'LOCAL_PAYMENT_LEDGER_INTEGRATION_PASS' as result;
