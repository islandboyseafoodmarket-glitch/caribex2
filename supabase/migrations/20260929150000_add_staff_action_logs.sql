create table if not exists public.staff_action_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  actor_email text,
  actor_role text not null default 'staff',
  action text not null,
  entity_type text not null,
  entity_id uuid,
  tracking text,
  customer_name text,
  customer_account_number bigint,
  success boolean not null default true,
  error_message text,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists staff_action_logs_created_at_idx
  on public.staff_action_logs(created_at desc);
create index if not exists staff_action_logs_actor_idx
  on public.staff_action_logs(actor_id, created_at desc);
create index if not exists staff_action_logs_action_idx
  on public.staff_action_logs(action, created_at desc);
create index if not exists staff_action_logs_entity_idx
  on public.staff_action_logs(entity_type, entity_id, created_at desc);
create index if not exists staff_action_logs_tracking_idx
  on public.staff_action_logs(tracking, created_at desc);

alter table public.staff_action_logs enable row level security;

drop policy if exists "Admins and staff can view staff action logs" on public.staff_action_logs;
create policy "Admins and staff can view staff action logs"
  on public.staff_action_logs
  for select
  to authenticated
  using (
    exists (select 1 from public.administradores where id = auth.uid())
    or exists (select 1 from public.personal where id = auth.uid())
  );

create or replace function public.staff_action_log_actor_role(actor uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.administradores where id = actor) then 'admin'
    when exists (select 1 from public.personal where id = actor) then 'staff'
    else null
  end;
$$;

create or replace function public.record_staff_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  role_name text;
  row_data jsonb;
  row_id uuid;
  tracking_value text;
  customer_id uuid;
  customer_name_value text;
  customer_account_value bigint;
begin
  role_name := public.staff_action_log_actor_role(actor);
  if role_name is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  row_id := nullif(row_data->>'id', '')::uuid;
  tracking_value := nullif(row_data->>'tracking', '');
  customer_id := nullif(row_data->>'numero_cliente_id', '')::uuid;

  if customer_id is not null then
    select c.nombre, c.numero_cliente
      into customer_name_value, customer_account_value
      from public.numero_cliente c
     where c.id = customer_id;
  end if;

  insert into public.staff_action_logs (
    actor_id, actor_name, actor_email, actor_role, action, entity_type,
    entity_id, tracking, customer_name, customer_account_number, details
  )
  select
    actor,
    coalesce(p.nombre, p.nombre_personal, a.rol),
    u.email,
    role_name,
    lower(tg_op),
    tg_table_name,
    row_id,
    tracking_value,
    customer_name_value,
    customer_account_value,
    jsonb_build_object(
      'source', 'database_trigger',
      'operation', tg_op,
      'new', case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
      'old', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end
    )
  from auth.users u
  left join public.personal p on p.id = actor
  left join public.administradores a on a.id = actor
  where u.id = actor;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists staff_action_log_paquetes_registro on public.paquetes_registro;
create trigger staff_action_log_paquetes_registro
after insert or update or delete on public.paquetes_registro
for each row execute function public.record_staff_row_change();

drop trigger if exists staff_action_log_paquetes_checkin on public.paquetes_checkin;
create trigger staff_action_log_paquetes_checkin
after insert or update or delete on public.paquetes_checkin
for each row execute function public.record_staff_row_change();

drop trigger if exists staff_action_log_contenedores on public.contenedores;
create trigger staff_action_log_contenedores
after insert or update or delete on public.contenedores
for each row execute function public.record_staff_row_change();

drop trigger if exists staff_action_log_contenedor_paquetes on public.contenedor_paquetes;
create trigger staff_action_log_contenedor_paquetes
after insert or update or delete on public.contenedor_paquetes
for each row execute function public.record_staff_row_change();

drop trigger if exists staff_action_log_facturas on public.facturas;
create trigger staff_action_log_facturas
after insert or update or delete on public.facturas
for each row execute function public.record_staff_row_change();

drop trigger if exists staff_action_log_factura_items on public.factura_items;
create trigger staff_action_log_factura_items
after insert or update or delete on public.factura_items
for each row execute function public.record_staff_row_change();

drop trigger if exists staff_action_log_ferry_manifests on public.ferry_manifests;
create trigger staff_action_log_ferry_manifests
after insert or update or delete on public.ferry_manifests
for each row execute function public.record_staff_row_change();

drop trigger if exists staff_action_log_ferry_manifest_entries on public.ferry_manifest_entries;
create trigger staff_action_log_ferry_manifest_entries
after insert or update or delete on public.ferry_manifest_entries
for each row execute function public.record_staff_row_change();

drop trigger if exists staff_action_log_numero_cliente on public.numero_cliente;
create trigger staff_action_log_numero_cliente
after insert or update or delete on public.numero_cliente
for each row execute function public.record_staff_row_change();

drop trigger if exists staff_action_log_customer_leads on public.customer_leads;
create trigger staff_action_log_customer_leads
after insert or update or delete on public.customer_leads
for each row execute function public.record_staff_row_change();

drop trigger if exists staff_action_log_personal on public.personal;
create trigger staff_action_log_personal
after insert or update or delete on public.personal
for each row execute function public.record_staff_row_change();
