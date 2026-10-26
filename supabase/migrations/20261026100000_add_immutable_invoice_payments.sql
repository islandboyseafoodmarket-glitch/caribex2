-- Immutable, append-only invoice payment ledger.
-- All financial writes happen through the two SECURITY DEFINER RPCs below.

begin;

create table if not exists public.invoice_payment_entries (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.paquetes_registro(id) on delete restrict,
  entry_type text not null check (entry_type in ('PAYMENT', 'REVERSAL')),
  amount numeric(14,2) not null check (amount > 0 and amount = round(amount, 2)),
  method text,
  reference text,
  notes text,
  payment_date date,
  created_by uuid,
  created_at timestamptz not null default now(),
  original_payment_id uuid references public.invoice_payment_entries(id) on delete restrict,
  idempotency_key uuid not null unique,
  is_legacy boolean not null default false,
  request_fingerprint text not null,
  constraint invoice_payment_entries_reversal_original_check check (
    (entry_type = 'PAYMENT' and original_payment_id is null)
    or (entry_type = 'REVERSAL' and original_payment_id is not null)
  ),
  constraint invoice_payment_entries_date_check check (payment_date is not null or is_legacy)
);

create index if not exists invoice_payment_entries_invoice_created_idx
  on public.invoice_payment_entries (invoice_id, created_at, id);

create unique index if not exists invoice_payment_entries_one_reversal_per_payment_idx
  on public.invoice_payment_entries (original_payment_id)
  where entry_type = 'REVERSAL';

comment on table public.invoice_payment_entries is
  'Immutable USD invoice payment ledger. Corrections are represented by REVERSAL rows.';
comment on column public.invoice_payment_entries.is_legacy is
  'True when imported from the pre-ledger payment fields during migration.';
comment on column public.invoice_payment_entries.request_fingerprint is
  'Server-computed idempotency payload fingerprint; not a secret.';

-- Even service-role clients cannot mutate this table directly. The approved RPCs
-- set this transaction-local marker only for their own inserts.
create or replace function public.prevent_direct_invoice_payment_entry_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE', 'TRUNCATE') then
    raise exception using
      errcode = '42501',
      message = 'Payment ledger entries are immutable and cannot be updated, deleted, or truncated';
  end if;
  if current_setting('caribex.payment_ledger_write', true) is distinct from 'rpc' then
    raise exception using
      errcode = '42501',
      message = 'Payment ledger entries are immutable and may only be written by the approved payment RPCs';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists invoice_payment_entries_immutable_trigger on public.invoice_payment_entries;
create trigger invoice_payment_entries_immutable_trigger
before insert or update or delete on public.invoice_payment_entries
for each row execute function public.prevent_direct_invoice_payment_entry_mutation();
drop trigger if exists invoice_payment_entries_immutable_truncate_trigger on public.invoice_payment_entries;
create trigger invoice_payment_entries_immutable_truncate_trigger
before truncate on public.invoice_payment_entries
for each statement execute function public.prevent_direct_invoice_payment_entry_mutation();

alter table public.invoice_payment_entries enable row level security;
drop policy if exists invoice_payment_entries_admin_select on public.invoice_payment_entries;
create policy invoice_payment_entries_admin_select
on public.invoice_payment_entries
for select
to authenticated
using (exists (select 1 from public.administradores where id = auth.uid()));

revoke all on table public.invoice_payment_entries from anon, authenticated;
grant select on table public.invoice_payment_entries to authenticated;
revoke all on table public.invoice_payment_entries from service_role;
grant select on table public.invoice_payment_entries to service_role;

-- A balance view includes invoices with no ledger rows, so an empty ledger never
-- fabricates payment from the legacy invoice_status value.
create or replace view public.invoice_payment_balances as
select
  p.id as invoice_id,
  p.billing_total,
  coalesce(sum(case when e.entry_type = 'PAYMENT' then e.amount when e.entry_type = 'REVERSAL' then -e.amount else 0 end), 0)::numeric(14,2) as paid,
  greatest(coalesce(p.billing_total, 0) - coalesce(sum(case when e.entry_type = 'PAYMENT' then e.amount when e.entry_type = 'REVERSAL' then -e.amount else 0 end), 0), 0)::numeric(14,2) as balance,
  p.invoice_status
from public.paquetes_registro p
left join public.invoice_payment_entries e on e.invoice_id = p.id
group by p.id, p.billing_total, p.invoice_status;

revoke all on public.invoice_payment_balances from anon, authenticated, service_role;
grant select on public.invoice_payment_balances to service_role;

-- Import only invoices already marked PAID and with a real total. The stable
-- UUID derived from the invoice makes this safe to rerun.
select set_config('caribex.payment_ledger_write', 'rpc', true);
insert into public.invoice_payment_entries (
  invoice_id, entry_type, amount, method, reference, notes, payment_date,
  created_by, created_at, idempotency_key, is_legacy, request_fingerprint
)
select
  p.id,
  'PAYMENT',
  p.billing_total,
  p.payment_method,
  p.payment_reference,
  p.payment_notes,
  p.payment_date,
  null,
  now(),
  md5('legacy-invoice-payment:' || p.id::text)::uuid,
  true,
  md5(concat_ws(chr(31), p.id::text, 'PAYMENT', p.billing_total::text,
    coalesce(p.payment_method, ''), coalesce(p.payment_reference, ''),
    coalesce(p.payment_notes, ''), coalesce(p.payment_date::text, ''),
    'legacy'))
from public.paquetes_registro p
where upper(coalesce(p.invoice_status, '')) = 'PAID'
  and p.billing_total is not null
  and p.billing_total > 0
  and not exists (
    select 1 from public.invoice_payment_entries e
    where e.invoice_id = p.id
  );

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text default null,
  p_notes text default null,
  p_payment_date date default current_date,
  p_idempotency_key uuid default null,
  p_actor uuid default null,
  p_customer_invoice_note text default null
)
returns table (
  entry_id uuid,
  invoice_id uuid,
  entry_type text,
  amount numeric,
  method text,
  reference text,
  notes text,
  payment_date date,
  created_by uuid,
  created_at timestamptz,
  original_payment_id uuid,
  idempotency_key uuid,
  is_legacy boolean,
  paid numeric,
  balance numeric,
  invoice_status text,
  billing_total numeric,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_invoice public.paquetes_registro%rowtype;
  v_existing public.invoice_payment_entries%rowtype;
  v_entry public.invoice_payment_entries%rowtype;
  v_paid numeric(14,2);
  v_balance numeric(14,2);
  v_status text;
  v_fingerprint text;
begin
  if p_actor is null or not exists (select 1 from public.administradores where id = p_actor) then
    raise exception using errcode = '42501', message = 'ADMIN_ACTOR_REQUIRED';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_method is null or p_method not in ('Zelle', 'PayPal', 'Cash', 'Bank Transfer', 'Wire', 'Credit granted') then
    raise exception using errcode = '22023', message = 'INVALID_PAYMENT_METHOD';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception using errcode = '22023', message = 'INVALID_PAYMENT_AMOUNT';
  end if;
  if p_payment_date is null then
    raise exception using errcode = '22023', message = 'PAYMENT_DATE_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_invoice
  from public.paquetes_registro
  where id = p_invoice_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVOICE_NOT_FOUND';
  end if;
  if v_invoice.billing_total is null or v_invoice.billing_total < 0 then
    raise exception using errcode = 'P0001', message = 'INVOICE_TOTAL_REQUIRED';
  end if;

  v_fingerprint := md5(concat_ws(chr(31), p_invoice_id::text, 'PAYMENT',
    p_amount::numeric(14,2)::text, p_method, coalesce(p_reference, ''),
    coalesce(p_notes, ''), p_payment_date::text, coalesce(p_customer_invoice_note, '')));

  select e.* into v_existing
  from public.invoice_payment_entries e
  where e.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    select coalesce(sum(case when e.entry_type = 'PAYMENT' then e.amount when e.entry_type = 'REVERSAL' then -e.amount else 0 end), 0)::numeric(14,2)
      into v_paid from public.invoice_payment_entries e where e.invoice_id = p_invoice_id;
    v_balance := greatest(v_invoice.billing_total - v_paid, 0)::numeric(14,2);
    return query select v_existing.id, v_existing.invoice_id, v_existing.entry_type,
      v_existing.amount, v_existing.method, v_existing.reference, v_existing.notes,
      v_existing.payment_date, v_existing.created_by, v_existing.created_at,
      v_existing.original_payment_id, v_existing.idempotency_key, v_existing.is_legacy,
      v_paid, v_balance, v_invoice.invoice_status::text, v_invoice.billing_total, true;
    return;
  end if;

  select coalesce(sum(case when e.entry_type = 'PAYMENT' then e.amount when e.entry_type = 'REVERSAL' then -e.amount else 0 end), 0)::numeric(14,2)
    into v_paid from public.invoice_payment_entries e where e.invoice_id = p_invoice_id;
  v_balance := greatest(v_invoice.billing_total - v_paid, 0)::numeric(14,2);
  if p_amount > v_balance then
    raise exception using errcode = 'P0001', message = 'PAYMENT_EXCEEDS_OUTSTANDING_BALANCE';
  end if;

  perform set_config('caribex.payment_ledger_write', 'rpc', true);
  insert into public.invoice_payment_entries (
    invoice_id, entry_type, amount, method, reference, notes, payment_date,
    created_by, idempotency_key, is_legacy, request_fingerprint
  ) values (
    p_invoice_id, 'PAYMENT', p_amount::numeric(14,2), p_method, p_reference, p_notes,
    p_payment_date, p_actor, p_idempotency_key, false, v_fingerprint
  ) returning * into v_entry;

  v_paid := (v_paid + v_entry.amount)::numeric(14,2);
  v_balance := greatest(v_invoice.billing_total - v_paid, 0)::numeric(14,2);
  v_status := case
    when v_balance = 0 then 'PAID'
    when upper(coalesce(v_invoice.invoice_status::text, '')) = 'PAID' then 'PENDING'
    else v_invoice.invoice_status::text
  end;

  update public.paquetes_registro
  set invoice_status = v_status,
      payment_method = v_entry.method,
      payment_reference = v_entry.reference,
      payment_notes = v_entry.notes,
      payment_date = v_entry.payment_date,
      customer_invoice_note = coalesce(p_customer_invoice_note, customer_invoice_note)
  where id = p_invoice_id;

  return query select v_entry.id, v_entry.invoice_id, v_entry.entry_type,
    v_entry.amount, v_entry.method, v_entry.reference, v_entry.notes,
    v_entry.payment_date, v_entry.created_by, v_entry.created_at,
    v_entry.original_payment_id, v_entry.idempotency_key, v_entry.is_legacy,
    v_paid, v_balance, v_status, v_invoice.billing_total, false;
end;
$$;

create or replace function public.reverse_invoice_payment(
  p_payment_id uuid,
  p_reason text,
  p_idempotency_key uuid,
  p_actor uuid,
  p_payment_date date default current_date
)
returns table (
  entry_id uuid,
  invoice_id uuid,
  entry_type text,
  amount numeric,
  method text,
  reference text,
  notes text,
  payment_date date,
  created_by uuid,
  created_at timestamptz,
  original_payment_id uuid,
  idempotency_key uuid,
  is_legacy boolean,
  paid numeric,
  balance numeric,
  invoice_status text,
  billing_total numeric,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_original public.invoice_payment_entries%rowtype;
  v_existing public.invoice_payment_entries%rowtype;
  v_entry public.invoice_payment_entries%rowtype;
  v_invoice public.paquetes_registro%rowtype;
  v_paid numeric(14,2);
  v_balance numeric(14,2);
  v_status text;
  v_date date := coalesce(p_payment_date, current_date);
  v_fingerprint text;
begin
  if p_actor is null or not exists (select 1 from public.administradores where id = p_actor) then
    raise exception using errcode = '42501', message = 'ADMIN_ACTOR_REQUIRED';
  end if;
  if p_payment_id is null then
    raise exception using errcode = '22023', message = 'PAYMENT_ID_REQUIRED';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception using errcode = '22023', message = 'REVERSAL_REASON_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_original
  from public.invoice_payment_entries e
  where e.id = p_payment_id
    and e.entry_type = 'PAYMENT';
  if not found then
    raise exception using errcode = 'P0001', message = 'ORIGINAL_PAYMENT_NOT_FOUND';
  end if;

  select * into v_invoice
  from public.paquetes_registro
  where id = v_original.invoice_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'INVOICE_NOT_FOUND';
  end if;

  v_fingerprint := md5(concat_ws(chr(31), v_original.invoice_id::text, 'REVERSAL',
    v_original.id::text, v_original.amount::numeric(14,2)::text, btrim(p_reason), v_date::text));

  select e.* into v_existing
  from public.invoice_payment_entries e
  where e.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_fingerprint <> v_fingerprint then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    select coalesce(sum(case when e.entry_type = 'PAYMENT' then e.amount when e.entry_type = 'REVERSAL' then -e.amount else 0 end), 0)::numeric(14,2)
      into v_paid from public.invoice_payment_entries e where e.invoice_id = v_invoice.id;
    v_balance := greatest(v_invoice.billing_total - v_paid, 0)::numeric(14,2);
    return query select v_existing.id, v_existing.invoice_id, v_existing.entry_type,
      v_existing.amount, v_existing.method, v_existing.reference, v_existing.notes,
      v_existing.payment_date, v_existing.created_by, v_existing.created_at,
      v_existing.original_payment_id, v_existing.idempotency_key, v_existing.is_legacy,
      v_paid, v_balance, v_invoice.invoice_status::text, v_invoice.billing_total, true;
    return;
  end if;

  if exists (select 1 from public.invoice_payment_entries e where e.original_payment_id = v_original.id and e.entry_type = 'REVERSAL') then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALREADY_REVERSED';
  end if;

  perform set_config('caribex.payment_ledger_write', 'rpc', true);
  insert into public.invoice_payment_entries (
    invoice_id, entry_type, amount, method, reference, notes, payment_date,
    created_by, original_payment_id, idempotency_key, is_legacy, request_fingerprint
  ) values (
    v_original.invoice_id, 'REVERSAL', v_original.amount, null, null, btrim(p_reason),
    v_date, p_actor, v_original.id, p_idempotency_key, false, v_fingerprint
  ) returning * into v_entry;

  select coalesce(sum(case when e.entry_type = 'PAYMENT' then e.amount when e.entry_type = 'REVERSAL' then -e.amount else 0 end), 0)::numeric(14,2)
    into v_paid from public.invoice_payment_entries e where e.invoice_id = v_invoice.id;
  v_balance := greatest(v_invoice.billing_total - v_paid, 0)::numeric(14,2);
  v_status := case when upper(coalesce(v_invoice.invoice_status::text, '')) = 'PAID' then 'PENDING' else v_invoice.invoice_status::text end;

  -- Keep the legacy summary fields useful without rewriting ledger history:
  -- expose the latest payment that is still active, or clear them if none is left.
  update public.paquetes_registro p
  set invoice_status = v_status,
      payment_method = latest.method,
      payment_reference = latest.reference,
      payment_notes = latest.notes,
      payment_date = latest.payment_date
  from lateral (
    select e.method, e.reference, e.notes, e.payment_date
    from public.invoice_payment_entries e
    where e.invoice_id = v_invoice.id
      and e.entry_type = 'PAYMENT'
      and not exists (
        select 1 from public.invoice_payment_entries r
        where r.entry_type = 'REVERSAL' and r.original_payment_id = e.id
      )
    order by e.created_at desc, e.id desc
    limit 1
  ) latest
  where p.id = v_invoice.id;

  if not found then
    update public.paquetes_registro
    set invoice_status = v_status, payment_method = null, payment_reference = null,
        payment_notes = null, payment_date = null
    where id = v_invoice.id;
  end if;

  return query select v_entry.id, v_entry.invoice_id, v_entry.entry_type,
    v_entry.amount, v_entry.method, v_entry.reference, v_entry.notes,
    v_entry.payment_date, v_entry.created_by, v_entry.created_at,
    v_entry.original_payment_id, v_entry.idempotency_key, v_entry.is_legacy,
    v_paid, v_balance, v_status, v_invoice.billing_total, false;
end;
$$;

revoke all on function public.record_invoice_payment(uuid, numeric, text, text, text, date, uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.reverse_invoice_payment(uuid, text, uuid, uuid, date) from public, anon, authenticated, service_role;
grant execute on function public.record_invoice_payment(uuid, numeric, text, text, text, date, uuid, uuid, text) to service_role;
grant execute on function public.reverse_invoice_payment(uuid, text, uuid, uuid, date) to service_role;

-- Prevent old clients from bypassing the ledger while app versions roll over.
create or replace function public.guard_invoice_payment_summary_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if current_setting('caribex.payment_ledger_write', true) = 'rpc' then
    return new;
  end if;
  if upper(coalesce(new.invoice_status, '')) = 'PAID'
     and upper(coalesce(old.invoice_status, '')) <> 'PAID' then
    raise exception using errcode = '42501', message = 'Record payment using the payment ledger; direct paid-status changes are not allowed';
  end if;
  if exists (select 1 from public.invoice_payment_entries e where e.invoice_id = old.id) then
    if (upper(coalesce(old.invoice_status, '')) = 'PAID' and new.invoice_status is distinct from old.invoice_status)
       or new.payment_method is distinct from old.payment_method
       or new.payment_reference is distinct from old.payment_reference
       or new.payment_notes is distinct from old.payment_notes
       or new.payment_date is distinct from old.payment_date then
      raise exception using errcode = '42501', message = 'Recorded payment details are immutable; record a reversal instead';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists invoice_payment_summary_guard on public.paquetes_registro;
create trigger invoice_payment_summary_guard
before update of invoice_status, payment_method, payment_reference, payment_notes, payment_date
on public.paquetes_registro
for each row execute function public.guard_invoice_payment_summary_update();

commit;
