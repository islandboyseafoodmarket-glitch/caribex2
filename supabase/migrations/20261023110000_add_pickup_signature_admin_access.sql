begin;

alter table public.pickup_signatures enable row level security;

drop policy if exists "Admins and staff can view pickup signatures" on public.pickup_signatures;
create policy "Admins and staff can view pickup signatures"
  on public.pickup_signatures
  for select
  to authenticated
  using (
    exists (select 1 from public.administradores where id = auth.uid())
    or exists (select 1 from public.personal where id = auth.uid())
  );

commit;
