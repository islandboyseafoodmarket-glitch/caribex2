begin;

create policy customer_leads_admin_select
  on public.customer_leads
  for select
  to authenticated
  using (
    exists (select 1 from public.administradores where id = auth.uid())
  );

create policy customer_leads_admin_update
  on public.customer_leads
  for update
  to authenticated
  using (
    exists (select 1 from public.administradores where id = auth.uid())
  )
  with check (
    exists (select 1 from public.administradores where id = auth.uid())
  );

commit;
