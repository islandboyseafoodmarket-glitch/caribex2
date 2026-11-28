begin;

create table if not exists public.staff_action_logs_actor_name_backup (
  log_id uuid primary key,
  old_actor_name text,
  backed_up_at timestamptz not null default now()
);

insert into public.staff_action_logs_actor_name_backup (log_id, old_actor_name)
select l.id, l.actor_name
from public.staff_action_logs l
join public.administradores a on a.id = l.actor_id
where l.actor_name is distinct from 'Admin'
  and (l.actor_name = l.actor_email or lower(l.actor_name) = lower(a.rol))
on conflict (log_id) do nothing;

update public.staff_action_logs l
set actor_name = 'Admin'
from public.administradores a
where a.id = l.actor_id
  and l.actor_name is distinct from 'Admin'
  and (l.actor_name = l.actor_email or lower(l.actor_name) = lower(a.rol));

alter table public.staff_action_logs_actor_name_backup enable row level security;

create or replace function public.record_staff_row_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
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
    coalesce(
      p.nombre,
      p.nombre_personal,
      case when a.id is not null then 'Admin' end,
      u.email
    ),
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

commit;
