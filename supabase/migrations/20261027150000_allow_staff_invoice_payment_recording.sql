-- Allow staff explicitly granted invoice access to record append-only payments.
-- Payment reversals remain Admin-only in the API and RPC.

begin;

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
  if p_actor is null
     or (
       not exists (select 1 from public.administradores where id = p_actor)
       and not exists (
         select 1 from public.personal
         where id = p_actor and permissions @> '{"invoices": true}'::jsonb
       )
     ) then
    raise exception using errcode = '42501', message = 'INVOICE_PAYMENT_ACTOR_REQUIRED';
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

commit;
