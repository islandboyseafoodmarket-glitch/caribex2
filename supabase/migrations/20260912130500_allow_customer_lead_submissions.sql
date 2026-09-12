begin;

create policy customer_leads_public_insert
  on public.customer_leads
  for insert
  to anon, authenticated
  with check (
    length(trim(nombre)) between 1 and 160
    and length(trim(email)) between 3 and 320
    and position('@' in email) > 1
    and length(trim(mensaje)) between 1 and 5000
  );

commit;
