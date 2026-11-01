begin;

do $$
declare
  function_def text;
begin
  for function_def in
    select pg_get_functiondef(p.oid)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('record_invoice_payment', 'reverse_invoice_payment')
  loop
    function_def := replace(
      function_def,
      'if p_actor is null or (not exists(select 1 from public.administradores where id=p_actor) and not exists(select 1 from public.personal where id=p_actor and permissions @> ''{"invoices": true}''::jsonb)) then',
      'if p_actor is null or not (exists (select 1 from public.administradores where id = p_actor) or exists (select 1 from public.personal where id = p_actor and permissions @> ''{"invoices": true}''::jsonb)) then'
    );
    function_def := replace(function_def, 'p_method not in (''Zelle'',''PayPal'',''Cash'',''Bank Transfer'',''Wire'',''Credit granted'')', 'p_method not in (''Zelle'',''PayPal'',''Cash'',''Bank Transfer / Wire'',''Credit granted'')');
    execute function_def;
  end loop;
end;
$$;

commit;
